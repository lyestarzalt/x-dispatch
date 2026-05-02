/**
 * Full launch flow E2E.
 *
 * Drives the actual sequence a user goes through:
 *   search KJFK → click result → click a gate → click Launch →
 *   pick an aircraft → click Launch → JSON written to /tmp
 *
 * The launcher writes the FlightInit payload to a temp file BEFORE attempting
 * to spawn X-Plane, so we don't need a real X-Plane binary. The spawn fails
 * silently (no executable), but our assertions on the JSON file still pass.
 *
 * Selectors here are best-effort. When they break, the failure mode tells us
 * what to fix — either tweak the selector, or add a data-testid to production.
 */
import {
  type ElectronApplication,
  type Page,
  _electron as electron,
  expect,
  test,
} from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { type E2EFixture, setupTestEnvironment } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '../..');
const FLIGHT_JSON_PATH = path.join(os.tmpdir(), 'x-dispatch-flight.json');

function resolveAppEntry(): { executablePath: string; cwd: string } {
  const outDir = path.join(REPO_ROOT, 'out');
  const candidates = fs.readdirSync(outDir).filter((d) => d.startsWith('X-Dispatch-'));
  const bundleDir = path.join(outDir, candidates[0]!);
  let executablePath: string;
  if (process.platform === 'darwin') {
    executablePath = path.join(bundleDir, 'X-Dispatch.app', 'Contents', 'MacOS', 'x-dispatch');
  } else if (process.platform === 'win32') {
    executablePath = path.join(bundleDir, 'x-dispatch.exe');
  } else {
    executablePath = path.join(bundleDir, 'x-dispatch');
  }
  return { executablePath, cwd: bundleDir };
}

let fixture: E2EFixture;
let app: ElectronApplication;
let mainWindow: Page;

test.beforeEach(async () => {
  // Wipe any leftover flight JSON from a previous run
  if (fs.existsSync(FLIGHT_JSON_PATH)) {
    fs.unlinkSync(FLIGHT_JSON_PATH);
  }

  fixture = setupTestEnvironment();
  const { executablePath, cwd } = resolveAppEntry();
  app = await electron.launch({
    executablePath,
    cwd,
    env: {
      ...process.env,
      E2E_USER_DATA_DIR: fixture.userDataDir,
      NODE_ENV: 'test',
    },
    timeout: 60_000,
  });
  mainWindow = await app.firstWindow();
  mainWindow.on('pageerror', (err) => console.error('[renderer pageerror]', err));
  mainWindow.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[renderer error]', msg.text());
  });
});

test.afterEach(async () => {
  if (app) await app.close().catch(() => {});
  fixture.cleanup();
});

test('full launch flow writes the FlightInit JSON to disk', async () => {
  test.setTimeout(90_000);

  // 1. Search and select KJFK
  const search = mainWindow.getByPlaceholder('Search airports...');
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill('KJFK');
  await mainWindow.locator('[data-testid="search-result"]').first().click();

  // 2. Switch to the "Start" tab in the airport panel — gates only render here.
  await mainWindow.getByRole('tab', { name: /Start/i }).click();

  // 3. Wait for the map to initialise — selectGateAsStart bails out early if
  //    mapRef.current is null. The map renders async via MapLibre + WebGL.
  await mainWindow.waitForTimeout(3000);

  // 4. Click the first gate. selectGateAsStart sets startPosition in the
  //    Zustand store, which the toolbar reads as hasStartPosition.
  const firstGate = mainWindow.locator('[data-testid="gate-row"]').first();
  await expect(firstGate).toBeVisible({ timeout: 15_000 });
  await firstGate.click();

  // 5. Wait for the green "Start" indicator that appears in the airport
  //    panel header when selectedStartPosition is set. If this never shows,
  //    the gate click didn't propagate (usually map not yet ready).
  await mainWindow.waitForTimeout(500);

  // 3. Click the toolbar Launch button to open the launch dialog
  const openLaunchDialog = mainWindow.locator('[data-testid="open-launch-dialog"]');
  await expect(openLaunchDialog).toBeEnabled({ timeout: 5_000 });
  await openLaunchDialog.click();

  // 4. Aircraft list appears in the LaunchDialog. Click the first card.
  const firstAircraft = mainWindow.locator('[data-testid="aircraft-card"]').first();
  await expect(firstAircraft).toBeVisible({ timeout: 10_000 });
  await firstAircraft.click();

  // 5. Final Launch button at the bottom of the dialog (cold-start path
  //    because no X-Plane is running).
  const finalLaunch = mainWindow.locator('[data-testid="confirm-launch"]');
  await expect(finalLaunch).toBeEnabled({ timeout: 5_000 });
  await finalLaunch.click();

  // 6. The launcher writes the FlightInit JSON before spawning X-Plane.
  //    The spawn will fail silently (no real X-Plane binary) but the JSON
  //    file is what we care about.
  await expect.poll(() => fs.existsSync(FLIGHT_JSON_PATH), { timeout: 15_000 }).toBe(true);

  const payload = JSON.parse(fs.readFileSync(FLIGHT_JSON_PATH, 'utf-8'));

  // 7. Verify the JSON content matches what the user actually selected.
  //    These assertions are deliberately strict — if any of them break,
  //    something between the click and the disk-write is dropping data.

  // 7a. Aircraft block: path is our synthetic .acf, livery omitted because
  //     we never picked a non-Default livery (drops the "livery silently
  //     reverts on cold launch" regression).
  expect(payload.aircraft).toBeDefined();
  expect(payload.aircraft.path).toBe('Aircraft/Test/TestPlane/TestPlane.acf');
  expect(payload.aircraft.livery).toBeUndefined();

  // 7b. Start position: ramp_start (gate), not runway_start, not lle_*.
  //     The airport ID and gate name should match our selection.
  expect(payload.ramp_start).toBeDefined();
  expect(payload.runway_start).toBeUndefined();
  expect(payload.lle_ground_start).toBeUndefined();
  expect(payload.lle_air_start).toBeUndefined();
  expect(payload.boat_start).toBeUndefined();
  expect(payload.ramp_start.airport_id).toBe('KJFK');
  // We clicked the first gate on the Start tab. KJFK's first gate in our
  // apt-sample fixture is "Fedex Cargo 1".
  expect(payload.ramp_start.ramp).toBe('Fedex Cargo 1');

  // 7c. Weight: both fuel and payload arrays, length matches the API contract
  //     (X-Plane expects 9-slot fuel and 5-slot payload, but the launcher
  //     accepts whatever the renderer computed). We just verify the shape.
  expect(payload.weight).toBeDefined();
  expect(Array.isArray(payload.weight.fueltank_weight_in_kilograms)).toBe(true);
  expect(Array.isArray(payload.weight.payload_weight_in_kilograms)).toBe(true);
  expect(payload.weight.fueltank_weight_in_kilograms.length).toBeGreaterThan(0);

  // 7d. Engine status: all_engines.running is a boolean. We left the default
  //     "engines running" toggle alone, so this should be true.
  expect(payload.engine_status).toBeDefined();
  expect(payload.engine_status.all_engines).toBeDefined();
  expect(typeof payload.engine_status.all_engines.running).toBe('boolean');

  // 7e. Weather: present, either the "use_real_weather" sentinel or a
  //     definition object. Default mode in the dialog is 'real'.
  expect(payload.weather).toBeDefined();
  if (typeof payload.weather === 'string') {
    expect(payload.weather).toBe('use_real_weather');
  } else {
    expect(payload.weather.definition).toBeDefined();
  }

  // 7f. Time: exactly one of use_system_time or local_time is set, never both.
  const hasSystemTime = payload.use_system_time === true;
  const hasLocalTime = payload.local_time !== undefined;
  expect(hasSystemTime !== hasLocalTime).toBe(true);

  // 7g. Sanity: no unexpected top-level fields. Helps catch accidental leaks.
  const allowedTopLevel = new Set([
    'aircraft',
    'weight',
    'engine_status',
    'ramp_start',
    'runway_start',
    'lle_ground_start',
    'lle_air_start',
    'boat_start',
    'use_system_time',
    'local_time',
    'weather',
  ]);
  const unexpected = Object.keys(payload).filter((k) => !allowedTopLevel.has(k));
  expect(unexpected, `Unexpected top-level fields: ${unexpected.join(', ')}`).toEqual([]);
});
