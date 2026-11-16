/**
 * The Custom Scenery check at startup reads the folder asynchronously, so the
 * main process keeps handling app events while it runs. These start the
 * packaged app twice against one userData dir: the first start fills the
 * cache, the second runs the check that decides whether the cache still holds.
 * A Custom Scenery folder with thousands of entries keeps that check running
 * long enough for a dock click or a quit to land inside it.
 */
import { type ElectronApplication, _electron as electron, expect, test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { CUSTOM_SCENERY_AIRPORT, type E2EFixture, setupTestEnvironment } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '../..');
/** Enough empty packs that the startup check takes a noticeable time. */
const EMPTY_PACKS = 30_000;

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

interface Run {
  app: ElectronApplication;
  /** Everything the app wrote to stdout and stderr. */
  output: string[];
}

async function start(): Promise<Run> {
  const { executablePath, cwd } = resolveAppEntry();
  const app = await electron.launch({
    executablePath,
    cwd,
    env: { ...process.env, E2E_USER_DATA_DIR: fixture.userDataDir, NODE_ENV: 'test' },
    timeout: 60_000,
  });
  const output: string[] = [];
  app.process().stdout?.on('data', (chunk) => output.push(String(chunk)));
  app.process().stderr?.on('data', (chunk) => output.push(String(chunk)));
  return { app, output };
}

async function expectAirport(app: ElectronApplication, icao: string, name: string): Promise<void> {
  const window = await app.firstWindow();
  const search = window.getByPlaceholder('Search airports...');
  await expect(search).toBeVisible({ timeout: 60_000 });
  await search.fill(icao);
  await expect(window.getByText(name).first()).toBeVisible({ timeout: 10_000 });
}

function addPack(icao: string, name: string): void {
  const dir = path.join(fixture.xplaneRoot, 'Custom Scenery', name, 'Earth nav data');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'apt.dat'),
    [
      'I',
      '1200 Version',
      '',
      `1    1200 0 0 ${icao} ${name}`,
      '1302 datum_lat 45.000000000',
      '1302 datum_lon 6.010000000',
      `1302 icao_code ${icao}`,
      '100 30.00 1 0 0.00 0 2 0 09 45.0000000 6.0000000 0 0 2 0 0 0 27 45.0000000 6.0200000 0 0 2 0 0 0',
      '99',
      '',
    ].join('\n')
  );
}

function addEmptyPacks(count: number): void {
  const customScenery = path.join(fixture.xplaneRoot, 'Custom Scenery');
  for (let i = 0; i < count; i++) fs.mkdirSync(path.join(customScenery, `Empty ${i}`));
}

/** First start: builds the airport cache the second start checks. */
async function fillCache(): Promise<void> {
  const first = await start();
  await expectAirport(first.app, CUSTOM_SCENERY_AIRPORT.icao, CUSTOM_SCENERY_AIRPORT.name);
  await first.app.close();
}

let fixture: E2EFixture;
let run: Run | undefined;

test.beforeEach(() => {
  fixture = setupTestEnvironment();
  run = undefined;
});

test.afterEach(async () => {
  await run?.app.close().catch(() => {});
  fixture.cleanup();
});

test('a pack added between starts is found on the next start', async () => {
  await fillCache();
  addPack('XDT2', 'Second Test Field');

  run = await start();

  await expectAirport(run.app, 'XDT2', 'Second Test Field');
  await expectAirport(run.app, CUSTOM_SCENERY_AIRPORT.icao, CUSTOM_SCENERY_AIRPORT.name);
});

test('a dock click during the startup check opens one main window', async () => {
  await fillCache();
  addEmptyPacks(EMPTY_PACKS);

  run = await start();
  // macOS sends `activate` on a dock click; repeat it across the check.
  await run.app.evaluate(({ app }) => {
    for (const delay of [0, 50, 200]) setTimeout(() => app.emit('activate'), delay);
  });
  await expectAirport(run.app, CUSTOM_SCENERY_AIRPORT.icao, CUSTOM_SCENERY_AIRPORT.name);

  const windows = await run.app.evaluate(
    ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
  );
  expect(windows).toBe(1);
});

test('quitting during the startup check exits without an error', async () => {
  await fillCache();
  addEmptyPacks(EMPTY_PACKS);

  run = await start();
  const exited = new Promise<number | null>((resolve) =>
    run!.app.process().on('exit', (code) => resolve(code))
  );
  await run.app.evaluate(({ app }) => setTimeout(() => app.quit(), 20));

  expect(await exited).toBe(0);
  const output = run.output.join('');
  expect(output).not.toMatch(/Unhandled promise rejection/);
  expect(output).not.toMatch(/Database not initialized|database is not open/);
});
