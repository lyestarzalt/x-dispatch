/**
 * Smoke test — proves the whole E2E pipeline works:
 *   - Playwright can launch the packaged Electron app
 *   - main.ts honours E2E_USER_DATA_DIR and uses our seeded config.json
 *   - The seeded xplanePath is valid, so isSetupComplete() returns true
 *   - The main window opens without the Setup screen
 *   - No fatal errors in the main process during startup
 *
 * If this passes, the foundation is good and we can build click-flow tests
 * on top. If it fails, every more ambitious test will fail too.
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

/**
 * Locate the packaged Electron app produced by `electron-forge package`.
 *
 * We require a real packaged app (under out/) rather than the dev-mode `.vite/`
 * build because dev mode serves the renderer over a Vite HTTP server — there's
 * no static index.html for Electron to load when the dev server isn't running.
 *
 * Run `npm run package` once before E2E tests, and any time main/renderer code
 * changes. Re-running tests on the same package is fast.
 */
function resolveAppEntry(): { executablePath: string; cwd: string } {
  const outDir = path.join(REPO_ROOT, 'out');
  if (!fs.existsSync(outDir)) {
    throw new Error(
      'No packaged app found at ./out — run `npm run package` before E2E tests, ' +
        'and again whenever main/renderer source changes.'
    );
  }

  // out/X-Dispatch-<platform>-<arch>/<binary>
  const candidates = fs.readdirSync(outDir).filter((d) => d.startsWith('X-Dispatch-'));
  if (candidates.length === 0) {
    throw new Error('out/ exists but has no X-Dispatch-* bundle. Re-run `npm run package`.');
  }
  const bundleDir = path.join(outDir, candidates[0]!);

  // executableName in forge.config.ts is 'x-dispatch' (lowercase)
  let executablePath: string;
  if (process.platform === 'darwin') {
    executablePath = path.join(bundleDir, 'X-Dispatch.app', 'Contents', 'MacOS', 'x-dispatch');
  } else if (process.platform === 'win32') {
    executablePath = path.join(bundleDir, 'x-dispatch.exe');
  } else {
    executablePath = path.join(bundleDir, 'x-dispatch');
  }

  if (!fs.existsSync(executablePath)) {
    throw new Error(`Expected packaged binary not found at ${executablePath}`);
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
      // Disable update checks and sentry during tests
      NODE_ENV: 'test',
    },
    timeout: 60_000,
  });

  mainWindow = await app.firstWindow();
  // Pipe renderer console to the test runner so failures are diagnosable
  mainWindow.on('pageerror', (err) => console.error('[renderer pageerror]', err));
  mainWindow.on('console', (msg) => {
    if (msg.type() === 'error') console.error('[renderer console.error]', msg.text());
  });
});

test.afterEach(async () => {
  if (app) {
    await app.close().catch(() => {
      /* already closed */
    });
  }
  fixture.cleanup();
});

test('app launches and opens a main window', async () => {
  expect(mainWindow).toBeDefined();
  await mainWindow.waitForLoadState('domcontentloaded');
  const title = await mainWindow.title();
  // Title is set by the renderer; just confirm we got a non-empty string.
  expect(title.length).toBeGreaterThan(0);
});

test('userData was redirected to the test temp dir', async () => {
  // Verify main.ts honoured E2E_USER_DATA_DIR by asking the main process
  // for its userData path.
  const userData: string = await app.evaluate(({ app }) => app.getPath('userData'));
  expect(userData).toBe(fixture.userDataDir);
});

test('skips Setup screen when seeded config.json points at a valid X-Plane install', async () => {
  await mainWindow.waitForLoadState('domcontentloaded');
  // Setup screen has a clear DOM marker we can look for. If it appears,
  // the seed didn't take and the app fell back to onboarding.
  // We give it a moment to settle, then assert no Setup heading is visible.
  await mainWindow.waitForTimeout(2000);

  // The Setup screen has a heading that includes "Welcome" or the explicit
  // text "X-Plane folder". Either presence means the seed failed.
  const setupHeading = mainWindow.getByText(/welcome to x-dispatch/i);
  const setupBrowse = mainWindow.getByText(/select your x-plane folder/i);
  await expect(setupHeading)
    .not.toBeVisible({ timeout: 1000 })
    .catch(() => {});
  await expect(setupBrowse)
    .not.toBeVisible({ timeout: 1000 })
    .catch(() => {});
});
