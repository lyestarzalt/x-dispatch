import * as path from 'path';
import type { AddonType, ArchiveEntry, ArchiveFormat, DetectedItem, MarkerFile } from '../types';
import { ADDON_TYPE_PRIORITY, IGNORE_PATTERNS, PLATFORM_FOLDERS } from '../types';
import { detectLiveries, looksLikeUnknownLivery } from './liveryPatterns';
import { detectLuaComponents } from './luaScripts';
import { detectNavdata } from './navdata';

/**
 * Check if a path should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split(/[/\\]/);
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
 * Folder holding a marker file, with a trailing slash.
 * Returns null when the marker sits at the archive root, meaning the archive
 * itself is the addon folder.
 */
function parentDir(markerPath: string): string | null {
  const segments = markerPath.replace(/\\/g, '/').split('/');
  if (segments.length < 2) return null;
  return segments.slice(0, -1).join('/') + '/';
}

/**
 * Get the addon root folder from a marker file path.
 *
 * The root is the folder that gets copied into X-Plane, so it is the marker's
 * own folder, not the outermost folder in the archive. `Pack/B738/B738.acf`
 * installs `B738`, never `Pack`.
 */
function getAddonRoot(markerPath: string, markerType: AddonType): string | null {
  const normalized = markerPath.replace(/\\/g, '/');
  const parent = parentDir(normalized);

  switch (markerType) {
    case 'Aircraft': {
      if (!parent) return null;
      // An AI variant lives one level below the aircraft it belongs to.
      const parentName = path.basename(parent.replace(/\/$/, ''));
      if (parentName === '_TCAS_AI_') {
        return parentDir(parent.replace(/\/$/, ''));
      }
      return parent;
    }

    case 'Scenery': {
      const parts = normalized.split('/').filter((p) => p.length > 0);
      for (let i = parts.length - 1; i >= 0; i--) {
        if (parts[i]?.toLowerCase() === 'earth nav data') {
          if (i === 0) return null;
          return parts.slice(0, i).join('/') + '/';
        }
      }
      return null;
    }

    case 'SceneryLibrary':
    case 'Navdata':
      return parent;

    case 'Plugin':
      return getPluginDir(normalized);

    case 'LuaScript':
      return parent;

    default:
      return null;
  }
}

/**
 * Get display name from addon root
 */
function getDisplayName(archivePath: string, internalRoot: string | null): string {
  if (internalRoot) {
    return path.basename(internalRoot.replace(/\/$/, ''));
  }
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
 * Deepest folder that contains every given root, with a trailing slash.
 */
function commonRoot(roots: string[]): string | null {
  if (roots.length === 0) return null;
  let prefix = (roots[0] ?? '').split('/').filter(Boolean);
  for (const root of roots.slice(1)) {
    const segments = root.split('/').filter(Boolean);
    let i = 0;
    while (i < prefix.length && i < segments.length && prefix[i] === segments[i]) i++;
    prefix = prefix.slice(0, i);
  }
  return prefix.length === 0 ? null : prefix.join('/') + '/';
}

function sizeUnder(entries: ArchiveEntry[], internalRoot: string | null): number {
  const scoped = internalRoot ? entries.filter((e) => e.path.startsWith(internalRoot)) : entries;
  return scoped.reduce((sum, e) => sum + e.uncompressedSize, 0);
}

/**
 * Scan archive entries and detect all addons
 */
export function detectAddons(
  archivePath: string,
  archiveFormat: ArchiveFormat,
  entries: ArchiveEntry[]
): DetectedItem[] {
  const usable = entries.filter((e) => !shouldIgnore(e.path));

  // Collect markers and directory sets
  const markers: MarkerFile[] = [];
  const pluginDirs = new Set<string>();
  const aircraftDirs = new Set<string>();

  // Pass 1: Collect all markers
  for (const entry of usable) {
    if (entry.isDirectory) continue;

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
  let luaEmitted = false;

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
        const hasDsf = usable.some(
          (e) =>
            e.path.startsWith(root) &&
            e.path.toLowerCase().includes('earth nav data') &&
            e.path.toLowerCase().endsWith('.dsf')
        );
        if (hasDsf) continue; // Skip, will be detected as Scenery
      }
    }

    // A Lua pack is described by its components, so one item covers every
    // .lua file in it rather than one item per script.
    if (marker.type === 'LuaScript') {
      if (luaEmitted) continue;
      const components = detectLuaComponents(usable);
      if (components.length === 0) continue;
      luaEmitted = true;

      const packRoot = commonRoot(components.map((c) => c.internalRoot));

      detected.push({
        id: crypto.randomUUID(),
        addonType: 'LuaScript',
        displayName: getDisplayName(archivePath, packRoot),
        sourcePath: archivePath,
        archiveFormat,
        archiveInternalRoot: packRoot ?? undefined,
        luaComponents: components,
        estimatedSize: sizeUnder(usable, packRoot),
        warnings: [],
      });
      continue;
    }

    const internalRoot = getAddonRoot(marker.path, marker.type);
    const displayName = getDisplayName(archivePath, internalRoot);

    const item: DetectedItem = {
      id: crypto.randomUUID(),
      addonType: marker.type,
      displayName,
      sourcePath: archivePath,
      archiveFormat,
      archiveInternalRoot: internalRoot ?? undefined,
      estimatedSize: sizeUnder(usable, internalRoot),
      warnings: [],
    };

    if (marker.type === 'Navdata') {
      const navdata = detectNavdata(archivePath, usable, internalRoot ?? '');
      item.navdataInfo = navdata.info;
      item.navdataSubPath = navdata.subPath;
    }

    // Add to skip prefixes
    if (internalRoot) {
      skipPrefixes.push(internalRoot);
    }

    detected.push(item);
  }

  detected.push(...detectLiveryItems(archivePath, archiveFormat, usable, skipPrefixes, detected));

  return detected;
}

/**
 * Liveries an archive carries that are not already part of a detected aircraft.
 */
function detectLiveryItems(
  archivePath: string,
  archiveFormat: ArchiveFormat,
  entries: ArchiveEntry[],
  skipPrefixes: string[],
  detected: DetectedItem[]
): DetectedItem[] {
  const items: DetectedItem[] = [];

  for (const match of detectLiveries(entries)) {
    if (match.internalRoot && skipPrefixes.some((p) => match.internalRoot.startsWith(p))) continue;
    if (!match.internalRoot && detected.length > 0) continue;

    items.push({
      id: crypto.randomUUID(),
      addonType: 'Livery',
      displayName: getDisplayName(archivePath, match.internalRoot || null),
      sourcePath: archivePath,
      archiveFormat,
      archiveInternalRoot: match.internalRoot || undefined,
      liveryInfo: {
        aircraftTypeId: match.aircraftTypeId,
        aircraftName: match.aircraftName,
      },
      estimatedSize: sizeUnder(entries, match.internalRoot || null),
      warnings: [],
    });
  }

  if (items.length === 0 && detected.length === 0 && looksLikeUnknownLivery(entries)) {
    items.push({
      id: crypto.randomUUID(),
      addonType: 'Livery',
      displayName: getDisplayName(archivePath, null),
      sourcePath: archivePath,
      archiveFormat,
      estimatedSize: sizeUnder(entries, null),
      warnings: ['Aircraft could not be identified - choose the target aircraft before installing'],
    });
  }

  return items;
}
