/**
 * A second launch must hand over to the running app and quit without starting
 * anything of its own. It used to clear the running session's log as it loaded,
 * and on Windows its startup went on to bind the tablet port the first copy
 * held ("EADDRINUSE 0.0.0.0:8480" in the logs).
 */
import {
  type ElectronApplication,
  type Page,
  _electron as electron,
  expect,
  test,
} from '@playwright/test';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { type E2EFixture, setupTestEnvironment } from './fixtures';

const REPO_ROOT = path.resolve(__dirname, '../..');
/** Not the default 8480, so a real X-Dispatch on this machine cannot hold it. */
const TABLET_PORT = 18480;

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

/** Runs the app a second time on the same userData and resolves with what it printed. */
function launchSecondInstance(
  env: NodeJS.ProcessEnv
): Promise<{ output: string; exited: boolean }> {
  const { executablePath, cwd } = resolveAppEntry();
  return new Promise((resolve) => {
    const child = spawn(executablePath, [], { cwd, env });
    let output = '';
    child.stdout.on('data', (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (output += chunk.toString()));
    const giveUp = setTimeout(() => {
      child.kill();
      resolve({ output, exited: false });
    }, 30_000);
    child.on('exit', () => {
      clearTimeout(giveUp);
      resolve({ output, exited: true });
    });
  });
}

let fixture: E2EFixture;
let app: ElectronApplication;
let mainWindow: Page;
let env: Record<string, string>;

test.beforeEach(async () => {
  fixture = setupTestEnvironment();
  // Tablet access on: the first copy holds the port, as it does for those users.
  const configPath = path.join(fixture.userDataDir, 'config.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
  config.remoteAccess = { enabled: true, port: TABLET_PORT, token: 'e2e-token' };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

  env = {
    ...(process.env as Record<string, string>),
    E2E_USER_DATA_DIR: fixture.userDataDir,
    NODE_ENV: 'test',
  };
  const { executablePath, cwd } = resolveAppEntry();
  app = await electron.launch({ executablePath, cwd, env, timeout: 60_000 });
  mainWindow = await app.firstWindow();
});

test.afterEach(async () => {
  await app?.close().catch(() => {});
  fixture.cleanup();
});

test('a second launch quits without starting up beside the running app', async () => {
  await expect(mainWindow.getByPlaceholder(/search airports/i)).toBeVisible({ timeout: 30_000 });
  const logPath = path.join(await app.evaluate(({ app: a }) => a.getPath('logs')), 'main.log');
  const logBefore = fs.readFileSync(logPath, 'utf-8');
  expect(logBefore).toContain('Tablet access server listening');

  const second = await launchSecondInstance(env);

  expect(second.exited).toBe(true);
  // The running session's log is still there: the second copy used to clear it.
  expect(fs.readFileSync(logPath, 'utf-8').startsWith(logBefore)).toBe(true);
  // What the second copy logged when it started the tablet server on a taken port.
  expect(second.output).not.toContain('Tablet access server failed to start');

  // The first copy is untouched and still answers.
  await expect(mainWindow.getByPlaceholder(/search airports/i)).toBeVisible();
});
