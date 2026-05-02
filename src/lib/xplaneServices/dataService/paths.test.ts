/**
 * Tests for the path-resolution layer that maps a user's X-Plane root into
 * the specific data files X-Dispatch reads.
 *
 * Focus areas:
 *  - Custom Data overrides (Navigraph users) take precedence over default data
 *  - getAptDataPath always points at Global Scenery (no custom override)
 *  - getCifpPath upper-cases the ICAO and prefers Custom Data when present
 *  - validateXPlanePath produces accurate error lists for missing pieces
 *  - detectXPlanePaths finds only installs that exist AND validate
 *  - Symlinks to the X-Plane folder are followed transparently
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  XPLANE_PATHS,
  detectXPlanePaths,
  getAptDataPath,
  getAtcDataPath,
  getCifpPath,
  getFixDataPath,
  getNavDataPath,
  validateXPlanePath,
} from './paths';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let TEMP_ROOT: string;

function tempInstall(label: string): string {
  return fs.mkdtempSync(path.join(TEMP_ROOT, `${label}-`));
}

/**
 * Build a minimal valid X-Plane install layout: Resources/default data with
 * the nav/fix/awy/airspaces data files plus the Global Airports apt.dat.
 */
function makeValidInstall(root: string) {
  const defaultData = path.join(root, 'Resources', 'default data');
  fs.mkdirSync(defaultData, { recursive: true });
  fs.writeFileSync(path.join(defaultData, 'earth_nav.dat'), 'default-nav');
  fs.writeFileSync(path.join(defaultData, 'earth_fix.dat'), 'default-fix');
  fs.writeFileSync(path.join(defaultData, 'earth_awy.dat'), 'default-awy');
  fs.writeFileSync(path.join(defaultData, 'earth_hold.dat'), 'default-hold');
  fs.writeFileSync(path.join(defaultData, 'earth_aptmeta.dat'), 'default-aptmeta');
  fs.mkdirSync(path.join(defaultData, 'airspaces'), { recursive: true });
  fs.writeFileSync(path.join(defaultData, 'airspaces', 'airspace.txt'), 'default-airspace');
  fs.mkdirSync(path.join(defaultData, 'CIFP'), { recursive: true });

  const globalApt = path.join(root, 'Global Scenery', 'Global Airports', 'Earth nav data');
  fs.mkdirSync(globalApt, { recursive: true });
  fs.writeFileSync(path.join(globalApt, 'apt.dat'), 'apt-data');
}

function addCustomDataNav(root: string, contents = 'navigraph-nav') {
  const customData = path.join(root, 'Custom Data');
  fs.mkdirSync(customData, { recursive: true });
  fs.writeFileSync(path.join(customData, 'earth_nav.dat'), contents);
}

function addCustomCifp(root: string, icao: string) {
  const dir = path.join(root, 'Custom Data', 'CIFP');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${icao}.dat`), `custom-${icao}`);
}

function addAtcData(root: string) {
  const dir = path.join(root, 'Custom Data', '1200 atc data', 'Earth nav data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'atc.dat'), 'atc-data');
}

beforeEach(() => {
  TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-paths-test-'));
});

afterEach(() => {
  if (fs.existsSync(TEMP_ROOT)) {
    fs.rmSync(TEMP_ROOT, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Custom Data overrides (Navigraph case)', () => {
  it('returns Custom Data nav file when it exists', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    addCustomDataNav(root, 'custom-nav');

    const resolved = getNavDataPath(root);
    expect(resolved).toContain(path.join('Custom Data', 'earth_nav.dat'));
    expect(fs.readFileSync(resolved, 'utf-8')).toBe('custom-nav');
  });

  it('falls back to default data when Custom Data file is missing', () => {
    const root = tempInstall('install');
    makeValidInstall(root);

    const resolved = getNavDataPath(root);
    expect(resolved).toContain(path.join('Resources', 'default data', 'earth_nav.dat'));
    expect(fs.readFileSync(resolved, 'utf-8')).toBe('default-nav');
  });

  it('applies Custom Data override independently per file', () => {
    // User has a custom earth_nav.dat but no custom earth_fix.dat
    const root = tempInstall('install');
    makeValidInstall(root);
    addCustomDataNav(root);

    expect(getNavDataPath(root)).toContain('Custom Data');
    expect(getFixDataPath(root)).toContain(path.join('Resources', 'default data'));
  });
});

describe('getAptDataPath', () => {
  it('always points at Global Scenery, ignoring Custom Data', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    // Even if a (nonsensical) Custom Data apt.dat existed, it should be ignored
    fs.mkdirSync(path.join(root, 'Custom Data'), { recursive: true });
    fs.writeFileSync(path.join(root, 'Custom Data', 'apt.dat'), 'fake');

    const resolved = getAptDataPath(root);
    expect(resolved).toBe(path.join(root, XPLANE_PATHS.globalAirports));
  });
});

describe('getCifpPath', () => {
  it('returns the Custom Data CIFP file when it exists', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    addCustomCifp(root, 'KJFK');

    const resolved = getCifpPath(root, 'KJFK');
    expect(resolved).toContain(path.join('Custom Data', 'CIFP', 'KJFK.dat'));
  });

  it('falls back to default CIFP folder when no custom file', () => {
    const root = tempInstall('install');
    makeValidInstall(root);

    const resolved = getCifpPath(root, 'EGLL');
    expect(resolved).toContain(path.join('Resources', 'default data', 'CIFP', 'EGLL.dat'));
  });

  it('upper-cases the ICAO before resolving', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    addCustomCifp(root, 'EHAM');

    const resolved = getCifpPath(root, 'eham');
    expect(resolved).toContain('EHAM.dat');
    expect(resolved).not.toContain('eham.dat');
  });
});

describe('getAtcDataPath', () => {
  it('returns the path when atc.dat exists', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    addAtcData(root);

    const resolved = getAtcDataPath(root);
    expect(resolved).toContain(path.join('Custom Data', '1200 atc data'));
  });

  it('returns null when atc.dat does not exist', () => {
    const root = tempInstall('install');
    makeValidInstall(root);

    expect(getAtcDataPath(root)).toBeNull();
  });
});

describe('validateXPlanePath', () => {
  it('reports valid for a complete install', () => {
    const root = tempInstall('install');
    makeValidInstall(root);

    const result = validateXPlanePath(root);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('reports invalid with a single error when the path does not exist', () => {
    const result = validateXPlanePath(path.join(TEMP_ROOT, 'does-not-exist'));
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(['Path does not exist']);
  });

  it('reports missing Resources directory', () => {
    const root = tempInstall('install');
    // Don't build anything inside

    const result = validateXPlanePath(root);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required directory: Resources');
  });

  it('reports missing default data subdirectory even if Resources exists', () => {
    const root = tempInstall('install');
    fs.mkdirSync(path.join(root, 'Resources'), { recursive: true });

    const result = validateXPlanePath(root);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required directory: Resources/default data');
  });

  it('reports missing earth_nav.dat specifically', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    fs.unlinkSync(path.join(root, XPLANE_PATHS.earthNav));

    const result = validateXPlanePath(root);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('earth_nav.dat'))).toBe(true);
  });

  it('reports missing earth_fix.dat specifically', () => {
    const root = tempInstall('install');
    makeValidInstall(root);
    fs.unlinkSync(path.join(root, XPLANE_PATHS.earthFix));

    const result = validateXPlanePath(root);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('earth_fix.dat'))).toBe(true);
  });

  it('accumulates multiple errors when several pieces are missing', () => {
    const root = tempInstall('install');
    fs.mkdirSync(path.join(root, 'Resources'), { recursive: true });
    // Resources exists but nothing else: missing default data + key files

    const result = validateXPlanePath(root);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });
});

describe('detectXPlanePaths', () => {
  // detectXPlanePaths reads process.env.HOME / USERPROFILE and walks a fixed
  // list of common locations. Point HOME at a temp dir for the duration of
  // each test so we don't pick up the developer's real X-Plane install.
  let originalHome: string | undefined;
  let originalUserProfile: string | undefined;

  beforeEach(() => {
    originalHome = process.env.HOME;
    originalUserProfile = process.env.USERPROFILE;
    process.env.HOME = TEMP_ROOT;
    process.env.USERPROFILE = TEMP_ROOT;
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    if (originalUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = originalUserProfile;
  });

  it('returns an empty list when no candidate locations exist', () => {
    const result = detectXPlanePaths();
    // The function also probes /Applications and C:\X-Plane 12 — those won't
    // contain a valid install on a CI box, so an empty list is the expectation.
    expect(result).toEqual([]);
  });

  it('finds an X-Plane 12 install in $HOME', () => {
    const root = path.join(TEMP_ROOT, 'X-Plane 12');
    fs.mkdirSync(root);
    makeValidInstall(root);

    const result = detectXPlanePaths();
    expect(result).toContain(root);
  });

  it('skips a $HOME folder that exists but is missing data files', () => {
    const root = path.join(TEMP_ROOT, 'X-Plane 12');
    fs.mkdirSync(root);
    // No data files inside -> validation fails -> not returned

    const result = detectXPlanePaths();
    expect(result).not.toContain(root);
  });
});

describe('symlink handling', () => {
  it('follows a symlink to an X-Plane install', () => {
    const real = path.join(TEMP_ROOT, 'real-install');
    fs.mkdirSync(real);
    makeValidInstall(real);

    const link = path.join(TEMP_ROOT, 'linked-install');
    try {
      fs.symlinkSync(real, link, 'dir');
    } catch (err) {
      // Windows without admin rights cannot create symlinks; skip in that case.
      if ((err as NodeJS.ErrnoException).code === 'EPERM') return;
      throw err;
    }

    const validation = validateXPlanePath(link);
    expect(validation.valid).toBe(true);

    // Reads through the symlink return the real-file contents
    const navPath = getNavDataPath(link);
    expect(fs.readFileSync(navPath, 'utf-8')).toBe('default-nav');
  });

  it('follows a symlinked Custom Data folder for Navigraph users', () => {
    const root = path.join(TEMP_ROOT, 'install');
    fs.mkdirSync(root);
    makeValidInstall(root);

    // Place the real Custom Data outside the install (e.g. on a different drive)
    const externalCustom = path.join(TEMP_ROOT, 'external-custom');
    fs.mkdirSync(externalCustom);
    fs.writeFileSync(path.join(externalCustom, 'earth_nav.dat'), 'navigraph-via-symlink');

    try {
      fs.symlinkSync(externalCustom, path.join(root, 'Custom Data'), 'dir');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EPERM') return;
      throw err;
    }

    const resolved = getNavDataPath(root);
    expect(fs.readFileSync(resolved, 'utf-8')).toBe('navigraph-via-symlink');
  });
});
