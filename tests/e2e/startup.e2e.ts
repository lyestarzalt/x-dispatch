/**
 * Startup must never wait on the CIFP procedure index. 2.9.0 scanned every
 * CIFP file synchronously inside the airport list fetch and froze the main
 * process for a minute on Windows. The packaged app is launched against a fake
 * install with CIFP files and no cache: the map must come up promptly and the
 * index must land in userData from the background rebuild.
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
const APPCH = 'APPCH:010,A,I04L,KILMA,KILMA,K6,E,A,EE B, ,   ,IF, , , , , ,      ,    ;\n';
const RWY = 'RWY:RW04 ,     ,      ,00013, ,    , ,   ;N40380000,W073460000\n';

function resolveAppEntry(): { executablePath: string; cwd: string } {
  const outDir = path.join(REPO_ROOT, 'out');
  const bundle = fs.readdirSync(outDir).find((d) => d.startsWith('X-Dispatch-'));
  if (!bundle) throw new Error('No packaged app under out/; run `npm run package` first.');
  const bundleDir = path.join(outDir, bundle);
  const executablePath =
    process.platform === 'darwin'
      ? path.join(bundleDir, 'X-Dispatch.app', 'Contents', 'MacOS', 'x-dispatch')
      : path.join(bundleDir, process.platform === 'win32' ? 'x-dispatch.exe' : 'x-dispatch');
  return { executablePath, cwd: bundleDir };
}

let fixture: E2EFixture;
let app: ElectronApplication;
let mainWindow: Page;

test.beforeEach(async () => {
  fixture = setupTestEnvironment();
  const cifp = path.join(fixture.xplaneRoot, 'Resources', 'default data', 'CIFP');
  fs.mkdirSync(cifp, { recursive: true });
  fs.writeFileSync(path.join(cifp, 'KJFK.dat'), RWY + APPCH);
  fs.writeFileSync(path.join(cifp, 'EGLL.dat'), RWY);
  const { executablePath, cwd } = resolveAppEntry();
  app = await electron.launch({
    executablePath,
    cwd,
    env: { ...process.env, E2E_USER_DATA_DIR: fixture.userDataDir, NODE_ENV: 'test' },
    timeout: 60_000,
  });
  mainWindow = await app.firstWindow();
});

test.afterEach(async () => {
  await app?.close().catch(() => {});
  fixture.cleanup();
});

test('the map comes up without waiting on the procedure index, which lands in the background', async () => {
  const startedAt = Date.now();
  await expect(mainWindow.getByPlaceholder(/search airports/i)).toBeVisible({ timeout: 30_000 });
  const readyAfterMs = Date.now() - startedAt;

  const cacheFile = path.join(fixture.userDataDir, 'cifp-procedures.json');
  await expect
    .poll(() => fs.existsSync(cacheFile), { timeout: 20_000, message: 'procedure index cache' })
    .toBe(true);
  const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8')) as { icaos: string[] };
  expect(cache.icaos).toEqual(['KJFK']);

  // Generous bound: the point is that startup is not serialized behind the scan.
  expect(readyAfterMs).toBeLessThan(30_000);
});
