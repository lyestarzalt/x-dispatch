/**
 * Target Path Resolver
 * Determines where each addon type should be installed in X-Plane.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { DetectedItem, InstallTask } from './types';

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

/**
 * Find aircraft folder that matches a livery's aircraft type
 */
function findAircraftForLivery(aircraftDir: string, aircraftTypeId: string): string | null {
  if (!fs.existsSync(aircraftDir)) return null;

  // Known aircraft folder patterns based on type ID
  const patterns: Record<string, string[]> = {
    FF_B777: ['777', 'FlightFactor 777'],
    TOLISS_A319: ['A319', 'ToLiss A319'],
    TOLISS_A320: ['A320', 'ToLiss A320'],
    TOLISS_A321: ['A321', 'ToLiss A321'],
    TOLISS_A339: ['A330', 'ToLiss A330'],
    TOLISS_A346: ['A340', 'ToLiss A340'],
    ZIBO_B738: ['B737-800X', 'b738', 'zibo'],
    LEVELUP_B737: ['737', 'LevelUp'],
  };

  const searchPatterns = patterns[aircraftTypeId] || [aircraftTypeId];

  const entries = fs.readdirSync(aircraftDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const lowerName = entry.name.toLowerCase();
    for (const pattern of searchPatterns) {
      if (lowerName.includes(pattern.toLowerCase())) {
        return path.join(aircraftDir, entry.name);
      }
    }
  }

  return null;
}

/**
 * Resolve navdata target path based on provider
 */
function resolveNavdataTarget(item: DetectedItem, xplanePath: string): string {
  const customData = path.join(xplanePath, 'Custom Data');

  if (!item.navdataInfo) {
    return customData;
  }

  const name = item.navdataInfo.name;

  if (name.includes('GNS430')) {
    return path.join(customData, 'GNS430');
  }

  if (name.includes('FlightFactor Boeing 777v2')) {
    return path.join(customData, 'STSFF', 'nav-data', 'ndbl', 'data');
  }

  return customData;
}

/**
 * Convert a DetectedItem to an InstallTask
 */
export function createInstallTask(item: DetectedItem, xplanePath: string): InstallTask {
  const { targetPath, conflictExists } = resolveTargetPath(item, xplanePath);

  return {
    ...item,
    targetPath,
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
