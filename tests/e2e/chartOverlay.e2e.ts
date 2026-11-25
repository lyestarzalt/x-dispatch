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
});
