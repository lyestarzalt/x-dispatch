import * as path from 'path';
import type {
  AddonType,
  ArchiveEntry,
  ArchiveFormat,
  DetectedItem,
  DetectedLiveryInfo,
} from '../types';
import { ADDON_TYPE_PRIORITY, IGNORE_PATTERNS, PLATFORM_FOLDERS } from '../types';
import { matchLivery } from './liveryPatterns';

/** A file that tells the add-on's type, and the folder it belongs to. */
interface Marker {
  path: string;
  type: AddonType;
  /** The add-on's folder inside the archive, with a trailing slash; null at the root. */
  root: string | null;
  liveryInfo?: DetectedLiveryInfo;
}

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
 * Some archives mirror the X-Plane folder: `Aircraft/Bird/bird.acf` next to
 * `Resources/plugins/Tool/64/win.xpl`. The layout folders are not the add-on's
 * name; they only say where it goes, which the type already tells us.
 */
const LAYOUT_PREFIXES = [
  'resources/plugins/flywithlua/scripts/',
  'resources/plugins/',
  'custom scenery/',
  'custom data/',
  'aircraft/',
];

/** Split a marker path into an X-Plane layout prefix (or '') and the rest. */
function splitLayoutPrefix(markerPath: string): { prefix: string; rest: string } {
  const lower = markerPath.toLowerCase();
  for (const candidate of LAYOUT_PREFIXES) {
    if (lower.startsWith(candidate)) {
      return {
        prefix: markerPath.slice(0, candidate.length),
        rest: markerPath.slice(candidate.length),
      };
    }
  }
  return { prefix: '', rest: markerPath };
}

/**
 * Get the addon root folder from a marker file path
 */
function getAddonRoot(markerPath: string, markerType: AddonType): string | null {
  const { prefix, rest } = splitLayoutPrefix(markerPath);
  const root = getAddonRootWithin(rest, markerType);
  if (root === null) return prefix || null;
  return prefix + root;
}

/** The add-on's folder relative to `markerPath`'s own tree, with no layout prefix. */
function getAddonRootWithin(markerPath: string, markerType: AddonType): string | null {
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
        if (parts[i]?.toLowerCase() === 'earth nav data') {
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
  // Use archive filename without extension (and without a volume suffix)
  const base = path.basename(archivePath).replace(/\.(zip|7z|rar)(\.\d{3,})?$/i, '');
  return base.replace(/\.part\d+$/i, '');
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
  const markers: Marker[] = [];
  const pluginDirs = new Set<string>();
  const aircraftDirs = new Set<string>();
  const liveryRoots = new Set<string>();

  // Pass 1: Collect all markers
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    if (shouldIgnore(entry.path)) continue;

    const markerType = detectMarkerType(entry.path);
    if (markerType) {
      markers.push({
        path: entry.path,
        type: markerType,
        root: getAddonRoot(entry.path, markerType),
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
      continue;
    }

    // A livery has no marker file of its own; its textures or icon name the aircraft
    const livery = matchLivery(entry.path);
    if (livery && !liveryRoots.has(livery.root)) {
      liveryRoots.add(livery.root);
      markers.push({
        path: entry.path,
        type: 'Livery',
        root: livery.root || null,
        liveryInfo: { aircraftTypeId: livery.aircraftTypeId, aircraftName: livery.aircraftName },
      });
    }
  }

  // An archive with an .acf is an aircraft; its icons and liveries are part of it
  if (markers.some((m) => m.type === 'Aircraft')) {
    for (let i = markers.length - 1; i >= 0; i--) {
      if (markers[i]?.type === 'Livery') markers.splice(i, 1);
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

    // Skip .xpl inside aircraft directories, and an aircraft's own liveries and icons
    if (marker.type === 'Plugin' || marker.type === 'Livery') {
      if (isInsideAny(marker.path, aircraftDirs)) continue;
    }

    // Check SceneryLibrary vs Scenery conflict
    // If folder has both library.txt AND .dsf, it's Scenery (higher priority)
    if (marker.type === 'SceneryLibrary') {
      const root = marker.root ?? '';
      const hasDsf = entries.some(
        (e) =>
          e.path.startsWith(root) &&
          e.path.toLowerCase().includes('earth nav data') &&
          e.path.toLowerCase().endsWith('.dsf')
      );
      if (hasDsf) continue; // Skip, will be detected as Scenery
    }

    const internalRoot = marker.root;
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
      markerPath: marker.path,
      estimatedSize,
      warnings: [],
    };
    if (marker.liveryInfo) item.liveryInfo = marker.liveryInfo;

    // Add to skip prefixes
    if (internalRoot) {
      skipPrefixes.push(internalRoot);
    } else {
      // The whole archive is this add-on; nothing deeper is another one
      skipPrefixes.push('');
    }

    detected.push(item);
  }

  return detected;
}
