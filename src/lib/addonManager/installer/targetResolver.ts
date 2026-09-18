/**
 * Target Path Resolver
 * Determines where each addon type should be installed in X-Plane.
 */
import * as fs from 'fs';
import * as path from 'path';
import { getLiveryPatterns, matchesAcfIdentifier } from './detection/liveryPatterns';
import type { DetectedItem, InstallComponent, InstallTask } from './types';

/**
 * Sanitize a folder name to prevent path traversal
 * Removes path separators and dangerous sequences
 */
function sanitizeFolderName(name: string): string {
  // Remove path separators and null bytes
  let sanitized = name.replace(/[/\\:\0]/g, '_');
  // Remove leading dots to prevent hidden files/directory traversal
  sanitized = sanitized.replace(/^\.+/, '');
  // Remove .. sequences
  sanitized = sanitized.replace(/\.\./g, '_');
  // Trim whitespace
  sanitized = sanitized.trim();
  // Fallback if empty
  return sanitized || 'unnamed_addon';
}

/**
 * Get the target installation path for an addon
 */
export function resolveTargetPath(
  item: DetectedItem,
  xplanePath: string
): { targetPath: string; conflictExists: boolean } {
  const targetPath = getTargetDirectory(item, xplanePath);
  const conflictExists = fs.existsSync(targetPath);

  return { targetPath, conflictExists };
}

/**
 * Get target directory based on addon type
 */
function getTargetDirectory(item: DetectedItem, xplanePath: string): string {
  const safeName = sanitizeFolderName(item.displayName);

  switch (item.addonType) {
    case 'Aircraft':
      return path.join(xplanePath, 'Aircraft', safeName);

    case 'Scenery':
    case 'SceneryLibrary':
      return path.join(xplanePath, 'Custom Scenery', safeName);

    case 'Plugin':
      return path.join(xplanePath, 'Resources', 'plugins', safeName);

    case 'LuaScript':
      return path.join(xplanePath, 'Resources', 'plugins', 'FlyWithLua', 'Scripts');

    case 'Livery':
      return resolveLiveryTarget(item, xplanePath);

    case 'Navdata':
      return resolveNavdataTarget(item, xplanePath);

    default:
      return path.join(xplanePath, 'Custom Scenery', safeName);
  }
}

/**
 * Every subtree the task installs, in the order they are applied.
 */
function resolveComponents(
  item: DetectedItem,
  xplanePath: string,
  targetPath: string
): InstallComponent[] {
  if (item.addonType === 'LuaScript' && item.luaComponents?.length) {
    const flyWithLua = path.join(xplanePath, 'Resources', 'plugins', 'FlyWithLua');
    return item.luaComponents.map((component) => ({
      internalRoot: component.internalRoot || undefined,
      targetPath: path.join(flyWithLua, component.targetSubdir),
    }));
  }

  return [{ internalRoot: item.archiveInternalRoot, targetPath }];
}

/**
 * Every .acf file under Aircraft, mapped to the folder that holds it.
 * One walk per resolve pass; the tree is shallow and this runs on drop, not
 * per frame.
 */
function collectInstalledAcf(aircraftDir: string): { acfFile: string; folder: string }[] {
  const found: { acfFile: string; folder: string }[] = [];

  const walk = (dir: string, depth: number) => {
    if (depth > 3) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
      } else if (path.extname(entry.name).toLowerCase() === '.acf') {
        found.push({ acfFile: entry.name, folder: dir });
      }
    }
  };

  walk(aircraftDir, 0);
  return found;
}

/**
 * Find the installed aircraft a livery belongs to.
 *
 * Matching runs against the .acf file names the aircraft ships, which is what
 * identifies a model. Folder names are renamed freely by users and say nothing.
 */
export function findAircraftForLivery(aircraftDir: string, aircraftTypeId: string): string | null {
  if (!fs.existsSync(aircraftDir)) return null;

  const pattern = getLiveryPatterns().find((p) => p.aircraft_type_id === aircraftTypeId);
  if (!pattern) return null;

  for (const candidate of collectInstalledAcf(aircraftDir)) {
    if (matchesAcfIdentifier(candidate.acfFile, pattern.acf_identifiers)) {
      return candidate.folder;
    }
  }

  return null;
}

/**
 * Resolve livery target path by finding the matching aircraft
 */
function resolveLiveryTarget(item: DetectedItem, xplanePath: string): string {
  const safeName = sanitizeFolderName(item.displayName);

  if (!item.liveryInfo) {
    return path.join(xplanePath, 'Aircraft', 'Unknown', 'liveries', safeName);
  }

  const aircraftDir = path.join(xplanePath, 'Aircraft');
  const targetAircraft = findAircraftForLivery(aircraftDir, item.liveryInfo.aircraftTypeId);

  if (targetAircraft) {
    return path.join(targetAircraft, 'liveries', safeName);
  }

  // Aircraft not found - still return the expected path so the confirmation
  // screen can show where it would go, with the warning attached by the caller.
  return path.join(xplanePath, 'Aircraft', 'Unknown', 'liveries', safeName);
}

/**
 * Resolve navdata target path based on the layout detected in the archive
 */
function resolveNavdataTarget(item: DetectedItem, xplanePath: string): string {
  return path.join(xplanePath, 'Custom Data', ...(item.navdataSubPath ?? []));
}

/**
 * Convert a DetectedItem to an InstallTask
 */
export function createInstallTask(item: DetectedItem, xplanePath: string): InstallTask {
  const { targetPath, conflictExists } = resolveTargetPath(item, xplanePath);

  return {
    ...item,
    targetPath,
    components: resolveComponents(item, xplanePath, targetPath),
    conflictExists,
    installMode: conflictExists ? 'overwrite' : 'fresh',
    backupOptions: {
      liveries: item.addonType === 'Aircraft',
      configFiles: item.addonType === 'Aircraft' || item.addonType === 'Plugin',
      configPatterns: ['*_prefs.txt', '*.cfg', '*.ini'],
      navdata: item.addonType === 'Navdata',
    },
    sizeConfirmed: item.estimatedSize < 5 * 1024 * 1024 * 1024, // Auto-confirm < 5GB
  };
}

/**
 * Check if FlyWithLua is installed (required for LuaScript addons)
 */
export function isFlyWithLuaInstalled(xplanePath: string): boolean {
  const flyWithLuaPath = path.join(xplanePath, 'Resources', 'plugins', 'FlyWithLua');
  return fs.existsSync(flyWithLuaPath);
}

/**
 * Check if target aircraft exists for a livery
 */
export function isLiveryAircraftInstalled(item: DetectedItem, xplanePath: string): boolean {
  if (!item.liveryInfo) return false;

  const aircraftDir = path.join(xplanePath, 'Aircraft');
  return findAircraftForLivery(aircraftDir, item.liveryInfo.aircraftTypeId) !== null;
}
