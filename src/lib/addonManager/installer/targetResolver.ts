/**
 * Target Path Resolver
 * Determines where each addon type should be installed in X-Plane.
 */
import * as fs from 'fs';
import * as path from 'path';
import { liveryAcfMatcher } from './detection/liveryPatterns';
import { readInstalledNavdata, readInstalledVersion } from './detection/versionInfo';
import type { DetectedItem, InstallTask } from './types';
import { INSTALLER_CONSTANTS } from './types';

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
 * Resolve livery target path by finding the matching aircraft
 */
function resolveLiveryTarget(item: DetectedItem, xplanePath: string): string {
  const safeName = sanitizeFolderName(item.displayName);

  if (!item.liveryInfo) {
    // Fallback: put in Custom Scenery
    return path.join(xplanePath, 'Custom Scenery', safeName);
  }

  const aircraftDir = path.join(xplanePath, 'Aircraft');
  const targetAircraft = findAircraftForLivery(aircraftDir, item.liveryInfo.aircraftTypeId);

  if (targetAircraft) {
    return path.join(targetAircraft, 'liveries', safeName);
  }

  // Aircraft not found - still return the expected path
  // The install will work but user should be warned
  return path.join(xplanePath, 'Aircraft', 'Unknown', 'liveries', safeName);
}

/** How deep under Aircraft/ an .acf may sit: Aircraft/Vendor/Model/model.acf. */
const ACF_SEARCH_DEPTH = 3;

/**
 * Find the folder of the installed aircraft whose .acf a livery's aircraft id matches
 */
function findAircraftForLivery(aircraftDir: string, aircraftTypeId: string): string | null {
  if (!fs.existsSync(aircraftDir)) return null;
  const matches = liveryAcfMatcher(aircraftTypeId);

  const walk = (dir: string, depth: number): string | null => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (!entry.name.toLowerCase().endsWith('.acf')) continue;
      if (matches(entry.name.slice(0, -4))) return dir;
    }
    if (depth >= ACF_SEARCH_DEPTH) return null;
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const found = walk(path.join(dir, entry.name), depth + 1);
      if (found) return found;
    }
    return null;
  };

  return walk(aircraftDir, 1);
}

/** Where a provider's data lives under Custom Data; the first matching keyword wins. */
const NAVDATA_TARGETS: Array<{ keyword: RegExp; subpath: string[] }> = [
  { keyword: /GNS430/i, subpath: ['GNS430'] },
  { keyword: /UFMC/i, subpath: ['UFMC'] },
  { keyword: /FlightFactor Boeing 777/i, subpath: ['STSFF', 'nav-data', 'ndbl', 'data'] },
];

/**
 * Resolve navdata target path based on provider
 */
function resolveNavdataTarget(item: DetectedItem, xplanePath: string): string {
  const customData = path.join(xplanePath, 'Custom Data');

  if (!item.navdataInfo) {
    return customData;
  }

  const name = item.navdataInfo.name;
  const target = NAVDATA_TARGETS.find((t) => t.keyword.test(name));
  return target ? path.join(customData, ...target.subpath) : customData;
}

/**
 * Convert a DetectedItem to an InstallTask
 */
export function createInstallTask(item: DetectedItem, xplanePath: string): InstallTask {
  const { targetPath, conflictExists } = resolveTargetPath(item, xplanePath);

  const existing: Pick<InstallTask, 'existingVersion' | 'existingNavdata'> = {};
  if (conflictExists && (item.addonType === 'Aircraft' || item.addonType === 'Plugin')) {
    existing.existingVersion = readInstalledVersion(targetPath);
  }
  if (conflictExists && item.addonType === 'Navdata') {
    existing.existingNavdata = readInstalledNavdata(targetPath);
  }

  return {
    ...item,
    ...existing,
    targetPath,
    conflictExists,
    installMode: conflictExists ? 'overwrite' : 'fresh',
    backupOptions: {
      liveries: item.addonType === 'Aircraft',
      configFiles: item.addonType === 'Aircraft' || item.addonType === 'Plugin',
      configPatterns: ['*_prefs.txt', '*.cfg', '*.ini'],
      navdata: item.addonType === 'Navdata',
    },
    sizeConfirmed: item.estimatedSize < INSTALLER_CONSTANTS.LARGE_ADDON_BYTES,
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
