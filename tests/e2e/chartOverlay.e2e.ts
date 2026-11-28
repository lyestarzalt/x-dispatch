/**
 * Approach chart on the map, in the packaged app.
 *
 * The chart is drawn by pdf.js, which loads a worker file of its own: the kind of thing that
 * works from the dev server and breaks once packaged. This runs the whole path with no
 * network: the app starts with the FAA chart list of the current cycle already downloaded
 * and the chart's PDF already in its disk cache.
 */
import {
  type ElectronApplication,
  type Page,
  _electron as electron,
  expect,
  test,
} from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { airacCycleAt } from '../../src/lib/xplaneServices/dataService/cycleInfo';
import { type E2EFixture, setupTestEnvironment } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '../..');
/** The cycle in force today, so the app sees a current list and asks the FAA for nothing. */
const CYCLE = airacCycleAt(new Date());
const PDF_NAME = '00610IL31R.PDF';
/** KJFK ILS OR LOC RWY 31R as the FAA published it in cycle 2612 (public domain). */
const CHART_PDF = path.join(REPO_ROOT, 'tests/fixtures/faa-chart-kjfk-ils31r.pdf');

/** The app's cache of the FAA chart list (`faa-charts.json`), with the one chart. */
const CHART_LIST_CACHE = {
  fetchedAt: new Date().toISOString(),
  index: {
    cycle: CYCLE,
    obstacleDepartures: {},
    rnavDepartures: {},
    rnavArrivals: {},
    ilsOrLoc: { KJFK: ['I31R'] },
    charts: { KJFK: [['IAP', 'ILS OR LOC RWY 31R', PDF_NAME, true]] },
  },
};

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
  fixture = setupTestEnvironment();

  // The chart list as a download leaves it, and the chart as a first showing leaves it.
  fs.writeFileSync(
    path.join(fixture.userDataDir, 'faa-charts.json'),
    JSON.stringify(CHART_LIST_CACHE)
  );
  const pdfCache = path.join(fixture.userDataDir, 'faa-chart-pdfs', CYCLE);
  fs.mkdirSync(pdfCache, { recursive: true });
  fs.copyFileSync(CHART_PDF, path.join(pdfCache, PDF_NAME));
  const cifp = path.join(fixture.xplaneRoot, 'Resources', 'default data', 'CIFP');
  fs.mkdirSync(cifp, { recursive: true });
  fs.writeFileSync(
    path.join(cifp, 'KJFK.dat'),
    'RWY:RW31R, , , ,00013, , , ,   ;N40380000,W073460000\n' +
      'APPCH:010,A,I31R,KILMA,KILMA,K6,E,A,EE B, ,   ,IF, , , , , ,      ,    ;\n'
  );
  const { executablePath, cwd } = resolveAppEntry();
  app = await electron.launch({
    executablePath,
    cwd,
    env: { ...process.env, E2E_USER_DATA_DIR: fixture.userDataDir, NODE_ENV: 'test' },
    timeout: 60_000,
  });
  mainWindow = await app.firstWindow();
  mainWindow.on('pageerror', (err) => console.error('[renderer pageerror]', err));
});

test.afterEach(async () => {
  if (app) await app.close().catch(() => {});
  fixture.cleanup();
});

test('an approach chart from the airport card is drawn and laid on the map', async () => {
  const search = mainWindow.getByPlaceholder('Search airports...');
  await expect(search).toBeVisible({ timeout: 30_000 });
  await search.fill('KJFK');
  await expect(mainWindow.getByText(/John F Kennedy/i).first()).toBeVisible({ timeout: 5_000 });
  await search.press('Enter');

  const approaches = mainWindow.getByRole('button', { name: /^Approaches/ });
  await expect(approaches).toBeVisible({ timeout: 30_000 });
  await approaches.click();
  await mainWindow.getByRole('button', { name: 'Show on the map' }).click();

  // The slider shows only once pdf.js has drawn the page and the layer is on the map.
  const card = mainWindow.getByRole('region', { name: 'Chart on the map' });
  await expect(card.getByText('ILS OR LOC RWY 31R')).toBeVisible({ timeout: 10_000 });
  await expect(card.getByRole('slider')).toBeVisible({ timeout: 30_000 });

  await card.getByRole('button', { name: 'Remove the chart' }).click();
  await expect(card).toBeHidden();
  const dock = mainWindow.getByTestId('airport-dock');
  await dock.getByRole('tab', { name: 'Proc', exact: true }).click();
  await dock.getByRole('tab', { name: /approach/i }).click();
  await expect(dock.getByRole('button', { name: /PDF.*ILS OR LOC RWY 31R/ })).toBeVisible();
  await dock.getByRole('button', { name: 'Show on the map' }).click();
  await expect(card.getByRole('slider')).toBeVisible();
});

test('the detached strip adjusts its own opacity without dimming the taxi map', async () => {
  await expect(mainWindow.getByPlaceholder('Search airports...')).toBeVisible({ timeout: 30000 });
  const opening = app.waitForEvent('window');
  await mainWindow.evaluate(() => window.appAPI.showFlightStripWindow());
  const strip = await opening;
  const panel = strip.locator('[data-strip-opacity="strip"]');
  await expect(panel).toBeVisible();
  await panel.dispatchEvent('wheel', {
    ctrlKey: true,
    deltaY: 100,
    bubbles: true,
    cancelable: true,
  });
  await expect(panel).toHaveCSS('opacity', '0.95');
  const settings = await mainWindow.evaluate(
    () => JSON.parse(localStorage.getItem('xplane-viz-settings')!).state.flightStrip
  );
  expect(settings.opacity).toBe(0.95);
  expect(settings.taxiMapOpacity).toBe(1);
});

test('the open taxi map follows takeoff and landing with independent opacity', async () => {
  const search = mainWindow.getByPlaceholder('Search airports...');
  await expect(search).toBeVisible({ timeout: 30000 });
  // A fresh profile stores no settings until one changes, so the pilot's switch turns it on.
  await mainWindow.getByRole('button', { name: 'Open settings' }).click();
  await mainWindow.getByRole('tab', { name: 'Flight Strip' }).click();
  const flightMap = mainWindow.getByRole('switch', { name: 'In-flight map' });
  await flightMap.click();
  await expect(flightMap).toBeChecked();
  await mainWindow.keyboard.press('Escape');
  await mainWindow.evaluate(() =>
    window.appAPI.setFlightStripGuidance({
      departure: {
        icao: 'KJFK',
        direction: 'departure',
        source: 'planned',
        runway: '31R',
        gateName: 'G1',
        points: [
          { lat: 40.64, lon: -73.78 },
          { lat: 40.65, lon: -73.77 },
        ],
        legs: [{ name: 'A', isRunway: false, runways: [] }],
        anchorNodeIds: [],
        nodeIds: [],
      },
      arrival: null,
    })
  );
  const opening = app.waitForEvent('window');
  await mainWindow.evaluate(() => window.appAPI.showFlightStripWindow());
  const strip = await opening;
  await strip.getByRole('button', { name: 'Taxi map' }).last().click();
  const taxiMap = strip.getByRole('region', { name: 'Taxi map' });
  await expect(taxiMap).toBeVisible();
  await taxiMap.dispatchEvent('wheel', {
    ctrlKey: true,
    deltaY: 100,
    bubbles: true,
    cancelable: true,
  });
  await expect(taxiMap).toHaveCSS('opacity', '0.95');
  await expect(strip.locator('[data-strip-opacity="strip"]')).toHaveCSS('opacity', '1');
  const ground = (onGround: boolean) =>
    app.evaluate(({ BrowserWindow }, landed) => {
      const win = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().includes('view=flight-strip')
      )!;
      win.webContents.send('xplaneService:stateUpdate', {
        latitude: 40.65,
        longitude: -73.77,
        heading: 90,
        onGround: landed,
      });
    }, onGround);
  await ground(true);
  await ground(false);
  await expect(strip.getByRole('region', { name: 'In-flight map' })).toBeVisible();
  await ground(true);
  await expect(taxiMap).toBeVisible();
  await expect(taxiMap).toHaveCSS('opacity', '0.95');
});
