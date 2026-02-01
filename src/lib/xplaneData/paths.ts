
import * as fs from 'fs';
import * as path from 'path';

/**
 * Standard X-Plane data file locations relative to installation root
 */
export const XPLANE_PATHS = {
  // Default data (shipped with X-Plane)
  defaultData: 'Resources/default data',

  // Navigation data files
  earthNav: 'Resources/default data/earth_nav.dat',
  earthFix: 'Resources/default data/earth_fix.dat',
  earthAwy: 'Resources/default data/earth_awy.dat',
  airspaces: 'Resources/default data/airspaces/airspace.txt',

  // CIFP (instrument procedures)
  cifpDir: 'Resources/default data/CIFP',

  // Airport data (Global Airports scenery)
  globalAirports: 'Global Scenery/Global Airports/Earth nav data/apt.dat',

  // Custom data (user overrides, e.g., Navigraph)
  customData: 'Custom Data',
  customNav: 'Custom Data/earth_nav.dat',
  customFix: 'Custom Data/earth_fix.dat',
  customAwy: 'Custom Data/earth_awy.dat',
  customAirspaces: 'Custom Data/airspaces/airspace.txt',
  customCifp: 'Custom Data/CIFP',

  //TODO: User data (pilot-created waypoints)
  userNav: 'Custom Data/user_nav.dat',
  userFix: 'Custom Data/user_fix.dat',
} as const;


export function resolveDataPath(
  xplanePath: string,
  relativePath: string,
  checkCustom = true
): string {
  // Check custom data first if requested
  if (checkCustom) {
    // Convert default data path to custom data equivalent
    const customPath = relativePath.replace('Resources/default data', 'Custom Data');
    const customFullPath = path.join(xplanePath, customPath);

    if (fs.existsSync(customFullPath)) {
      return customFullPath;
    }
  }

  return path.join(xplanePath, relativePath);
}


export function getNavDataPath(xplanePath: string): string {
  return resolveDataPath(xplanePath, XPLANE_PATHS.earthNav);
}


export function getFixDataPath(xplanePath: string): string {
  return resolveDataPath(xplanePath, XPLANE_PATHS.earthFix);
}


export function getAirwayDataPath(xplanePath: string): string {
  return resolveDataPath(xplanePath, XPLANE_PATHS.earthAwy);
}


export function getAirspaceDataPath(xplanePath: string): string {
  return resolveDataPath(xplanePath, XPLANE_PATHS.airspaces);
}

export function getAptDataPath(xplanePath: string): string {
  return path.join(xplanePath, XPLANE_PATHS.globalAirports);
}


export function getCifpPath(xplanePath: string, icao: string): string {
  // Check Custom Data first
  const customCifpPath = path.join(
    xplanePath,
    XPLANE_PATHS.customCifp,
    `${icao.toUpperCase()}.dat`
  );
  if (fs.existsSync(customCifpPath)) {
    return customCifpPath;
  }

  return path.join(xplanePath, XPLANE_PATHS.cifpDir, `${icao.toUpperCase()}.dat`);
}


export function validateXPlanePath(xplanePath: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(xplanePath)) {
    return { valid: false, errors: ['Path does not exist'] };
  }

  const requiredPaths = ['Resources', 'Resources/default data'];

  for (const reqPath of requiredPaths) {
    const fullPath = path.join(xplanePath, reqPath);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing required directory: ${reqPath}`);
    }
  }

  const keyFiles = [XPLANE_PATHS.earthNav, XPLANE_PATHS.earthFix];

  for (const keyFile of keyFiles) {
    const fullPath = path.join(xplanePath, keyFile);
    if (!fs.existsSync(fullPath)) {
      errors.push(`Missing data file: ${keyFile}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Auto-detect X-Plane installation paths
 * Returns array of potential X-Plane installation directories
 */
export function detectXPlanePaths(): string[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  const commonPaths = new Set([
    // Home directory (macOS, Linux, Windows)
    path.join(homeDir, 'X-Plane 12'),
    path.join(homeDir, 'X-Plane 11'),

    // macOS Applications
    '/Applications/X-Plane 12',
    '/Applications/X-Plane 11',

    // Windows common locations
    'C:\\X-Plane 12',
    'C:\\X-Plane 11',
    path.join(homeDir, 'Desktop', 'X-Plane 12'),
    path.join(homeDir, 'Desktop', 'X-Plane 11'),
  ]);

  const candidates: string[] = [];
  for (const candidate of commonPaths) {
    if (fs.existsSync(candidate)) {
      const validation = validateXPlanePath(candidate);
      if (validation.valid) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}
