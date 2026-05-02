/**
 * Tests for isXPlaneProcessRunning.
 *
 * The non-trivial behavior is the macOS branch's zombie filter: a recent
 * `X-Plane --version` call leaves a Z-state ghost in the process table, and
 * we must NOT count it as a running sim. The grep `^[SR]` is what filters
 * those out. If that filter regresses, every X-Dispatch user on macOS will
 * see "X-Plane is already running" warnings indefinitely after a single
 * version check. So this file is mostly about defending that filter.
 *
 * The catch-all `return false` is the other behavior worth pinning: if
 * tasklist or ps isn't installed (e.g. WSL without procps), we should fall
 * back to "not running" rather than crash the launcher.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockExec } = vi.hoisted(() => ({ mockExec: vi.fn() }));

vi.mock('child_process', () => ({
  exec: (cmd: string, cb: (err: Error | null, stdout: string, stderr: string) => void) =>
    mockExec(cmd, cb),
}));

const { isXPlaneProcessRunning } = await import('./processCheck');

const ORIGINAL_PLATFORM = process.platform;

function setPlatform(p: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: p, configurable: true });
}

// Note on the mock shape: `child_process.exec` has a custom util.promisify
// hook that resolves to `{ stdout, stderr }`. By mocking the whole module we
// lose that hook, so promisify falls back to default behavior (resolve with
// the second callback arg as a single value). To stay compatible with
// `const { stdout } = await execAsync(...)` in production code, the mock
// passes a `{ stdout, stderr }` object as that second arg.
function execReturns(stdout: string) {
  mockExec.mockImplementation(
    (_cmd: string, cb: (err: Error | null, value: { stdout: string; stderr: string }) => void) => {
      cb(null, { stdout, stderr: '' });
    }
  );
}

function execThrows(err: Error = new Error('command not found')) {
  mockExec.mockImplementation(
    (_cmd: string, cb: (err: Error | null, value: { stdout: string; stderr: string }) => void) => {
      cb(err, { stdout: '', stderr: err.message });
    }
  );
}

beforeEach(() => {
  mockExec.mockReset();
});

afterEach(() => {
  Object.defineProperty(process, 'platform', { value: ORIGINAL_PLATFORM, configurable: true });
});

describe('Windows', () => {
  beforeEach(() => setPlatform('win32'));

  it('returns true when tasklist output contains X-Plane.exe', async () => {
    execReturns('X-Plane.exe   12345 Console     1   2,123,456 K\n');
    expect(await isXPlaneProcessRunning()).toBe(true);
  });

  it('returns false when tasklist reports no matching tasks', async () => {
    execReturns('INFO: No tasks are running which match the specified criteria.\n');
    expect(await isXPlaneProcessRunning()).toBe(false);
  });

  it('matches case-insensitively (tasklist sometimes title-cases names)', async () => {
    execReturns('x-plane.exe   54321 Console     1   1,000,000 K\n');
    expect(await isXPlaneProcessRunning()).toBe(true);
  });
});

describe('macOS', () => {
  beforeEach(() => setPlatform('darwin'));

  it('returns true when ps reports a sleeping or running X-Plane process', async () => {
    // Real ps output already pre-filtered by the shell pipeline
    execReturns('S X-Plane\n');
    expect(await isXPlaneProcessRunning()).toBe(true);
  });

  it('returns false when no X-Plane line matches (zombie was filtered out by ps grep)', async () => {
    // The grep pipeline in processCheck rejects Z/UE state — by the time the
    // command resolves successfully, an empty stdout means "no live sim".
    execReturns('');
    expect(await isXPlaneProcessRunning()).toBe(false);
  });

  it('passes a [SR]-state filter to ps so zombie processes are excluded at the shell', async () => {
    // We assert on the command itself here because the filter is the entire
    // reason this code exists — silent removal of the [SR] grep would let
    // ghost processes (after --version calls) be reported as "running".
    execReturns('');
    await isXPlaneProcessRunning();
    const calledCmd = mockExec.mock.calls[0]?.[0] as string;
    expect(calledCmd).toContain("grep 'X-Plane$'");
    expect(calledCmd).toContain("grep '^[SR]'");
  });
});

describe('Linux', () => {
  beforeEach(() => setPlatform('linux'));

  it('returns true when ps reports a sleeping or running X-Plane-x86_64 process', async () => {
    execReturns('R X-Plane-x86_64\n');
    expect(await isXPlaneProcessRunning()).toBe(true);
  });

  it('returns false when grep finds no live X-Plane-x86_64 process', async () => {
    execReturns('');
    expect(await isXPlaneProcessRunning()).toBe(false);
  });

  it('matches X-Plane-x86_64 specifically (not just any X-Plane substring)', async () => {
    execReturns('');
    await isXPlaneProcessRunning();
    const calledCmd = mockExec.mock.calls[0]?.[0] as string;
    expect(calledCmd).toContain("grep 'X-Plane-x86_64$'");
  });
});

describe('graceful failure', () => {
  it('returns false when the underlying exec call rejects (e.g. tasklist missing)', async () => {
    setPlatform('win32');
    execThrows();
    expect(await isXPlaneProcessRunning()).toBe(false);
  });

  it('returns false when ps is unavailable on a stripped-down container', async () => {
    setPlatform('linux');
    execThrows(new Error('ps: command not found'));
    expect(await isXPlaneProcessRunning()).toBe(false);
  });

  it('returns false when grep exits with code 1 (no match found - exec rejects in promisify)', async () => {
    // grep returns exit code 1 when there are no matches, which makes the
    // promisified exec reject. The catch-all must convert this to "not running".
    setPlatform('darwin');
    execThrows(Object.assign(new Error('Command failed: ps -axo'), { code: 1 }));
    expect(await isXPlaneProcessRunning()).toBe(false);
  });
});
