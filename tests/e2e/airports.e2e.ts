/**
 * Airport-loading E2E test.
 *
 * Verifies the full pipeline from disk to UI:
 *  - app reads our fixture apt.dat
 *  - parser extracts the airports
 *  - cache populates
 *  - search UI surfaces them
 *
 * If this passes, the user can find airports the moment the app finishes
 * loading. If it fails, something between disk and UI is dropping data
 * silently and we want to know.
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
import { type E2EFixture, setupTestEnvironment } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '../..');

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
});

test.afterEach(async () => {
  if (app) await app.close().catch(() => {});
  fixture.cleanup();
});

test.describe('airports loaded from fixture apt.dat', () => {
  test('search finds KJFK and shows the airport name', async () => {
    // The search lives in the toolbar. Wait for it to mount; that implies
    // the main UI is past the loading screen and React Query has the
    // airport list cached.
    const search = mainWindow.getByPlaceholder('Search airports...');
    await expect(search).toBeVisible({ timeout: 30_000 });

    await search.fill('KJFK');

    // The result list should surface either the ICAO or the airport name.
    // We accept either since the exact label format may vary.
    await expect(mainWindow.getByText(/KJFK/).first()).toBeVisible({ timeout: 5_000 });
    await expect(mainWindow.getByText(/John F Kennedy/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('search finds EGLL (London Heathrow) — proves multiple airports loaded, not just one', async () => {
    const search = mainWindow.getByPlaceholder('Search airports...');
    await expect(search).toBeVisible({ timeout: 30_000 });

    await search.fill('EGLL');

    await expect(mainWindow.getByText(/EGLL/).first()).toBeVisible({ timeout: 5_000 });
    await expect(mainWindow.getByText(/Heathrow/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('search returns no results for an ICAO that is not in the fixture', async () => {
    // Negative case: confirms we're actually filtering against our fixture's
    // contents, not just always returning something. ZZZZ isn't in apt-sample.
    const search = mainWindow.getByPlaceholder('Search airports...');
    await expect(search).toBeVisible({ timeout: 30_000 });

    await search.fill('ZZZZ');

    // Expectation: the search dropdown either shows no results or stays empty.
    // The KJFK / EGLL labels should NOT appear.
    await mainWindow.waitForTimeout(500);
    await expect(mainWindow.getByText('John F Kennedy')).not.toBeVisible();
    await expect(mainWindow.getByText('London Heathrow')).not.toBeVisible();
  });
});
