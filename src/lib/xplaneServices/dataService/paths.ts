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

  // New navigation data files
  earthHold: 'Resources/default data/earth_hold.dat',
  earthAptMeta: 'Resources/default data/earth_aptmeta.dat',

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

  // Navigraph-specific data
  atcData: 'Custom Data/1200 atc data/Earth nav data/atc.dat',
  cycleJson: 'Custom Data/cycle.json',
  cycleInfoTxt: 'Custom Data/cycle_info.txt',

  // User data (pilot-created waypoints)
  userNav: 'Custom Data/user_nav.dat',
  userFix: 'Custom Data/user_fix.dat',
} as const;

function resolveDataPath(xplanePath: string, relativePath: string, checkCustom = true): string {
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

/** A SID, STAR or approach record at the start of a CIFP line. */
const CIFP_PROCEDURE_RECORD = /^(SID|STAR|APPCH):/m;
/**
 * How much of a CIFP file to read when looking for a procedure record. Procedures lead the
 * file; the few files that open with runway records list under a dozen of them (about 60
 * bytes each) before the first procedure. Measured on a full install: 0 misses at 1 KB.
 */
const CIFP_PEEK_BYTES = 2048;

/**
 * Every ICAO with at least one SID, STAR or approach, from the default data folder and Custom
 * Data (Navigraph). Over half of the CIFP files only list runways, so a file's existence is not
 * enough; the first {@link CIFP_PEEK_BYTES} of each are read. A Custom Data file replaces the
 * default one for that ICAO, so its verdict wins. About 0.4 s for 31k files on an SSD.
 */
/** Files opened at once while scanning CIFP; keeps the event loop free of a 7,000-file burst. */
const CIFP_SCAN_CONCURRENCY = 16;

/**
 * ICAOs whose CIFP file holds a SID, STAR or approach, from the default folder
 * and then Custom Data (which overrides per airport). Opens every file, so it
 * runs asynchronously in small batches: a synchronous pass blocked the main
 * process for seconds on a Mac and over a minute on Windows with real-time
 * antivirus scanning each open.
 */
export async function listProcedureIcaos(xplanePath: string): Promise<Set<string>> {
  const icaos = new Set<string>();
  for (const dir of [XPLANE_PATHS.cifpDir, XPLANE_PATHS.customCifp]) {
    const full = path.join(xplanePath, dir);
    let entries: string[];
    try {
      entries = await fs.promises.readdir(full);
    } catch {
      continue;
    }
    const files = entries.filter((e) => e.toLowerCase().endsWith('.dat'));
    for (let i = 0; i < files.length; i += CIFP_SCAN_CONCURRENCY) {
      const batch = files.slice(i, i + CIFP_SCAN_CONCURRENCY);
      const results = await Promise.all(
        batch.map((entry) => cifpFileHasProcedures(path.join(full, entry)))
      );
      batch.forEach((entry, j) => {
        const icao = entry.slice(0, -4).toUpperCase();
        if (results[j]) icaos.add(icao);
        else icaos.delete(icao);
      });
    }
  }
  return icaos;
}

async function cifpFileHasProcedures(filePath: string): Promise<boolean> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    handle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(CIFP_PEEK_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return CIFP_PROCEDURE_RECORD.test(buffer.toString('latin1', 0, bytesRead));
  } catch {
    return false;
  } finally {
    await handle?.close();
  }
}

export function getHoldDataPath(xplanePath: string): string {
  return resolveDataPath(xplanePath, XPLANE_PATHS.earthHold);
}

export function getAptMetaDataPath(xplanePath: string): string {
  return resolveDataPath(xplanePath, XPLANE_PATHS.earthAptMeta);
}

export function getAtcDataPath(xplanePath: string): string | null {
  const atcPath = path.join(xplanePath, XPLANE_PATHS.atcData);
  return fs.existsSync(atcPath) ? atcPath : null;
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
