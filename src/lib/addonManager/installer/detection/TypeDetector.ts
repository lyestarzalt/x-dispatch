import * as path from 'path';
import type { AddonType, ArchiveEntry, ArchiveFormat, DetectedItem, MarkerFile } from '../types';
import { ADDON_TYPE_PRIORITY, IGNORE_PATTERNS, PLATFORM_FOLDERS } from '../types';

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split('/');
  return parts.some((part) => IGNORE_PATTERNS.includes(part));
}

/**
 * Detect addon type from a file path
 */
function detectMarkerType(filePath: string): AddonType | null {
  const basename = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.acf') return 'Aircraft';
  if (basename === 'library.txt') return 'SceneryLibrary';
  if (ext === '.dsf') return 'Scenery';
  if (basename === 'cycle.json') return 'Navdata';
  if (ext === '.xpl') return 'Plugin';
  if (ext === '.lua') return 'LuaScript';

  return null;
}

/**
 * Get the addon root folder from a marker file path
 */
function getAddonRoot(markerPath: string, markerType: AddonType): string | null {
  const parts = markerPath.split('/').filter((p) => p.length > 0);

  switch (markerType) {
    case 'Aircraft': {
      // ACF parent folder = aircraft root
      // Handle _TCAS_AI_ subfolder
      const parent = path.dirname(markerPath);
      const parentName = path.basename(parent);
      if (parentName === '_TCAS_AI_') {
        return parts.length > 1 ? parts[0] + '/' : null;
      }
      return parent === '.' || parts.length === 0 ? null : parts[0] + '/';
    }

    case 'Scenery': {
      // Find "Earth nav data" in path, scenery root is its parent
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i].toLowerCase() === 'earth nav data') {
          if (i === 0) return null;
          return parts.slice(0, i).join('/') + '/';
        }
      }
      return null;
    }

    case 'SceneryLibrary': {
      const parent = path.dirname(markerPath);
      return parent === '.' || parts.length === 0 ? null : parts[0] + '/';
    }

    case 'Navdata': {
      const parent = path.dirname(markerPath);
      return parent === '.' ? null : parent + '/';
    }

    case 'Plugin': {
      const parent = path.dirname(markerPath);
      const parentName = path.basename(parent);
      // Handle platform subfolders
      if (PLATFORM_FOLDERS.includes(parentName.toLowerCase())) {
        return parts.length > 1 ? parts[0] + '/' : null;
      }
      return parent === '.' || parts.length === 0 ? null : parts[0] + '/';
    }

    case 'LuaScript': {
      const parent = path.dirname(markerPath);
      return parent === '.' || parts.length === 0 ? null : parts[0] + '/';
    }

    default:
      return null;
  }
}

/**
 * Get display name from addon root
 */
function getDisplayName(archivePath: string, internalRoot: string | null): string {
  if (internalRoot) {
    // Remove trailing slash and get last component
    return path.basename(internalRoot.replace(/\/$/, ''));
  }
  // Use archive filename without extension
  return path.basename(archivePath, path.extname(archivePath));
}

/**
 * Get the actual plugin directory (not the top-level archive root).
 * For conflict detection, we need where the plugin really lives,
 * not the computed addon root which may be the entire archive.
 */
function getPluginDir(xplPath: string): string | null {
  const parent = path.dirname(xplPath);
  const parentName = path.basename(parent);
  // If inside a platform subfolder (32, 64, win_x64, etc.), go up one more level
  if (PLATFORM_FOLDERS.includes(parentName.toLowerCase())) {
    const grandparent = path.dirname(parent);
    return grandparent === '.' ? null : grandparent + '/';
  }
  return parent === '.' ? null : parent + '/';
}

/**
 * Check if path is inside any of the given directories
 */
function isInsideAny(filePath: string, dirs: Set<string>): boolean {
  for (const dir of dirs) {
    if (filePath.startsWith(dir)) return true;
  }
  return false;
}

/**
 * Scan archive entries and detect all addons
 */
export function detectAddons(
  archivePath: string,
  archiveFormat: ArchiveFormat,
  entries: ArchiveEntry[]
): DetectedItem[] {
  // Collect markers and directory sets
  const markers: MarkerFile[] = [];
  const pluginDirs = new Set<string>();
  const aircraftDirs = new Set<string>();

  // Pass 1: Collect all markers
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (shouldIgnore(entry.path)) continue;

    const markerType = detectMarkerType(entry.path);
    if (markerType) {
      markers.push({
        path: entry.path,
        type: markerType,
        encrypted: entry.encrypted,
      });

      // Track actual plugin directories for exclusion (not the addon root,
      // which can be the whole archive and falsely overlap with aircraft roots)
      if (markerType === 'Plugin') {
        const dir = getPluginDir(entry.path);
        if (dir) pluginDirs.add(dir);
      }
      if (markerType === 'Aircraft') {
        const root = getAddonRoot(entry.path, 'Aircraft');
        if (root) aircraftDirs.add(root);
      }
    }
  }

  // Pass 2: Sort markers by depth (shallow first), then by priority
  markers.sort((a, b) => {
    const depthA = a.path.split('/').length;
    const depthB = b.path.split('/').length;
    if (depthA !== depthB) return depthA - depthB;
    return ADDON_TYPE_PRIORITY[a.type] - ADDON_TYPE_PRIORITY[b.type];
  });

  // Pass 3: Process markers with skip logic
  const skipPrefixes: string[] = [];
  const detected: DetectedItem[] = [];

  for (const marker of markers) {
    // Skip if already inside a detected addon
    if (skipPrefixes.some((prefix) => marker.path.startsWith(prefix))) continue;

    // Skip .dsf inside plugin directories (but never skip .acf — it's always an aircraft)
    if (marker.type === 'Scenery') {
      if (isInsideAny(marker.path, pluginDirs)) continue;
    }

    // Skip .xpl inside aircraft directories
    if (marker.type === 'Plugin') {
      if (isInsideAny(marker.path, aircraftDirs)) continue;
    }

    // Check SceneryLibrary vs Scenery conflict
    // If folder has both library.txt AND .dsf, it's Scenery (higher priority)
    if (marker.type === 'SceneryLibrary') {
      const root = getAddonRoot(marker.path, 'SceneryLibrary');
      if (root) {
        const hasDsf = entries.some(
          (e) =>
            e.path.startsWith(root) &&
            e.path.toLowerCase().includes('earth nav data') &&
            e.path.toLowerCase().endsWith('.dsf')
        );
        if (hasDsf) continue; // Skip, will be detected as Scenery
      }
    }

    const internalRoot = getAddonRoot(marker.path, marker.type);
    const displayName = getDisplayName(archivePath, internalRoot);

    // Calculate size for this addon
    const addonEntries = internalRoot
      ? entries.filter((e) => e.path.startsWith(internalRoot))
      : entries;
    const estimatedSize = addonEntries.reduce((sum, e) => sum + e.uncompressedSize, 0);

    const item: DetectedItem = {
      id: crypto.randomUUID(),
      addonType: marker.type,
      displayName,
      sourcePath: archivePath,
      archiveFormat,
      archiveInternalRoot: internalRoot ?? undefined,
      estimatedSize,
      warnings: [],
    };

    // Add to skip prefixes
    if (internalRoot) {
      skipPrefixes.push(internalRoot);
    }

    detected.push(item);
  }

  return detected;
}
