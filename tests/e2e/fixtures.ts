/**
 * E2E test fixtures: build a fake X-Plane install + a pre-seeded userData dir
 * so the app boots straight into the main UI (skipping Setup screen).
 *
 * Strategy:
 *  - Reuse the small *-sample.dat files we already use for unit tests
 *  - Lay them out in the directory shape validateXPlanePath() expects
 *  - Write config.json into a separate userData dir with xplanePath set
 *  - Hand both paths back to the test, which passes the userData dir via
 *    the E2E_USER_DATA_DIR env var (honoured by main.ts)
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '../..');
const UNIT_FIXTURES_DIR = path.join(REPO_ROOT, 'tests/fixtures');

export interface E2EFixture {
  /** Path that will be set as xplanePath in config.json */
  xplaneRoot: string;
  /** Path passed to Electron via E2E_USER_DATA_DIR env var */
  userDataDir: string;
  /** Tear down everything created by setupTestEnvironment */
  cleanup: () => void;
}

/**
 * Build a fresh X-Plane install + userData layout under a unique temp dir.
 * Each call returns isolated dirs so parallel tests don't collide.
 */
export function setupTestEnvironment(): E2EFixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-e2e-'));
  const xplaneRoot = path.join(root, 'xplane-install');
  const userDataDir = path.join(root, 'userdata');

  buildFakeXPlaneInstall(xplaneRoot);
  buildSeededUserData(userDataDir, xplaneRoot);

  return {
    xplaneRoot,
    userDataDir,
    cleanup: () => {
      if (fs.existsSync(root)) {
        fs.rmSync(root, { recursive: true, force: true });
      }
    },
  };
}

/**
 * Lay out the minimum file structure validateXPlanePath() requires, plus a
 * Global Airports apt.dat so the main UI has at least one airport to render.
 */
function buildFakeXPlaneInstall(root: string): void {
  const defaultData = path.join(root, 'Resources', 'default data');
  fs.mkdirSync(defaultData, { recursive: true });

  // Reuse the unit-test fixture nav data
  fs.copyFileSync(
    path.join(UNIT_FIXTURES_DIR, 'earth_nav-sample.dat'),
    path.join(defaultData, 'earth_nav.dat')
  );
  fs.copyFileSync(
    path.join(UNIT_FIXTURES_DIR, 'earth_fix-sample.dat'),
    path.join(defaultData, 'earth_fix.dat')
  );
  fs.copyFileSync(
    path.join(UNIT_FIXTURES_DIR, 'earth_awy-sample.dat'),
    path.join(defaultData, 'earth_awy.dat')
  );

  // Airspaces directory — content is consulted by some loaders but not required
  fs.mkdirSync(path.join(defaultData, 'airspaces'), { recursive: true });
  fs.copyFileSync(
    path.join(UNIT_FIXTURES_DIR, 'airspace-sample.txt'),
    path.join(defaultData, 'airspaces', 'airspace.txt')
  );

  // Empty CIFP dir so getCifpPath() resolves cleanly
  fs.mkdirSync(path.join(defaultData, 'CIFP'), { recursive: true });

  // Global Airports apt.dat
  const globalApt = path.join(root, 'Global Scenery', 'Global Airports', 'Earth nav data');
  fs.mkdirSync(globalApt, { recursive: true });
  fs.copyFileSync(path.join(UNIT_FIXTURES_DIR, 'apt-sample.dat'), path.join(globalApt, 'apt.dat'));

  // Synthetic test aircraft. Not a copy of any real X-Plane aircraft —
  // hand-written placeholder values so the parser has something to surface.
  // The acfParser only reads lines starting with `P acf/...` so this is
  // sufficient to register one aircraft in the launch dialog.
  const aircraftDir = path.join(root, 'Aircraft', 'Test', 'TestPlane');
  fs.mkdirSync(aircraftDir, { recursive: true });
  fs.writeFileSync(
    path.join(aircraftDir, 'TestPlane.acf'),
    [
      'A',
      '1135 version',
      'ACF',
      'P acf/_name TestPlane',
      'P acf/_ICAO TEST',
      'P acf/_descrip Synthetic E2E test aircraft',
      'P acf/_manufacturer X-Dispatch Tests',
      'P acf/_studio X-Dispatch Tests',
      'P acf/_author E2E Fixture',
      'P acf/_tailnum N0TEST',
      'P acf/_m_empty 1500',
      'P acf/_m_max 2400',
      'P acf/_m_fuel_max_tot 360',
      'P acf/_is_helicopter 0',
      'P acf/_num_engn 1',
      'P acf/_num_prop 1',
      'P acf/_Vne_kts 158',
      'P acf/_Vno_kts 129',
      'P acf/_tank_name/0 Main',
      'P acf/_tank_rat/0 1.0',
      '',
    ].join('\n'),
    'utf-8'
  );
}

/**
 * Pre-write config.json so isSetupComplete() returns true on first launch
 * and the app skips the Setup screen.
 */
function buildSeededUserData(userDataDir: string, xplaneRoot: string): void {
  fs.mkdirSync(userDataDir, { recursive: true });

  const config = {
    xplanePath: xplaneRoot,
    version: 1,
    lastUpdated: new Date().toISOString(),
    sendCrashReports: false, // never report from test runs
  };

  fs.writeFileSync(path.join(userDataDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}
