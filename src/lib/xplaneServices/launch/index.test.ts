/**
 * Tests for XPlaneLauncher.launch — specifically the 'spawn' vs 'error'
 * resolution that distinguishes a successful process start from an OS
 * refusal (Windows UAC → EACCES, missing exe → ENOENT, etc.).
 */
import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — all set up BEFORE importing the module under test.
// ---------------------------------------------------------------------------

// Logger: silent
vi.mock('@/lib/utils/logger', () => {
  const noop = () => {};
  const channel = { info: noop, warn: noop, error: noop, debug: noop };
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      main: channel,
      data: channel,
      ipc: channel,
      security: channel,
      launcher: channel,
      tracker: channel,
      addon: channel,
    },
    getLogPath: () => '/tmp/test.log',
  };
});

// CLI flags: empty
vi.mock('@/lib/cli', () => ({
  getCliFlags: () => ({ xpArgs: [] }),
}));

// Force the direct-spawn code path (not macOS+Steam). Tests stand in for
// Windows + Linux, which is where the spawn-error path is most interesting.
vi.mock('./freeflightGenerator', () => ({
  getXPlaneExecutable: () => '/fake/X-Plane.exe',
}));

vi.mock('../client/processCheck', () => ({
  isXPlaneProcessRunning: vi.fn().mockResolvedValue(false),
}));

vi.mock('./acfParser', () => ({
  scanAircraftDirectory: () => [],
}));

// fs.writeFileSync writes the temp flight JSON before spawn — no-op it
// (and keep readFileSync working for everything else that might import fs).
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    writeFileSync: vi.fn(),
    existsSync: vi.fn().mockReturnValue(false), // so isSteamInstallation() returns false
  };
});

// The star of the show: control spawn from the test so we can drive its
// events deterministically. `lastSpawned` is the EventEmitter the launcher
// is currently waiting on; the test fires events on it.
let lastSpawned: (EventEmitter & { unref: ReturnType<typeof vi.fn> }) | null = null;
const spawnMock = vi.fn(() => {
  const ee = Object.assign(new EventEmitter(), { unref: vi.fn() });
  lastSpawned = ee;
  return ee as unknown as ReturnType<typeof import('child_process').spawn>;
});

vi.mock('child_process', () => ({
  spawn: spawnMock,
  exec: vi.fn(),
}));

const { getLauncher } = await import('./index');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_PATH = '/Users/test/X-Plane 12';
// Minimal payload — only fields the launcher actually reads end up mattering,
// and at this layer it's mostly opaque (`buildFlightInit` is done upstream).
const PAYLOAD = {} as unknown as Parameters<ReturnType<typeof getLauncher>['launch']>[0];

beforeEach(() => {
  lastSpawned = null;
  spawnMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('XPlaneLauncher.launch — spawn vs error resolution', () => {
  it('resolves { success: true } when the "spawn" event fires', async () => {
    const launcher = getLauncher(FAKE_PATH);
    const launchPromise = launcher.launch(PAYLOAD);

    // The Promise constructor body inside launch() runs synchronously up to
    // the spawn() call. Wait one microtask so `lastSpawned` is assigned.
    await Promise.resolve();
    await Promise.resolve();
    expect(lastSpawned).not.toBeNull();

    lastSpawned!.emit('spawn');

    const result = await launchPromise;
    expect(result).toEqual({ success: true });
    expect(lastSpawned!.unref).toHaveBeenCalledTimes(1);
  });

  it('resolves with EACCES code when the OS refuses the spawn (UAC denied on Windows)', async () => {
    const launcher = getLauncher(FAKE_PATH);
    const launchPromise = launcher.launch(PAYLOAD);
    await Promise.resolve();
    await Promise.resolve();

    const err = Object.assign(new Error('spawn /fake/X-Plane.exe EACCES'), {
      code: 'EACCES',
      errno: -13,
      syscall: 'spawn /fake/X-Plane.exe',
    });
    lastSpawned!.emit('error', err);

    const result = await launchPromise;
    expect(result).toEqual({
      success: false,
      error: 'spawn /fake/X-Plane.exe EACCES',
      code: 'EACCES',
    });
    expect(lastSpawned!.unref).not.toHaveBeenCalled();
  });

  it('resolves with ENOENT code when the executable file is missing', async () => {
    const launcher = getLauncher(FAKE_PATH);
    const launchPromise = launcher.launch(PAYLOAD);
    await Promise.resolve();
    await Promise.resolve();

    const err = Object.assign(new Error('spawn /fake/X-Plane.exe ENOENT'), {
      code: 'ENOENT',
    });
    lastSpawned!.emit('error', err);

    const result = await launchPromise;
    expect(result.success).toBe(false);
    expect(result.code).toBe('ENOENT');
  });

  it('preserves err.message in the error field when no code is provided', async () => {
    const launcher = getLauncher(FAKE_PATH);
    const launchPromise = launcher.launch(PAYLOAD);
    await Promise.resolve();
    await Promise.resolve();

    // Some odd platform-specific cases emit an Error without err.code.
    lastSpawned!.emit('error', new Error('mystery failure'));

    const result = await launchPromise;
    expect(result.success).toBe(false);
    expect(result.error).toBe('mystery failure');
    expect(result.code).toBeUndefined();
  });

  it('settles exactly once even if "error" fires after "spawn"', async () => {
    // The Node docs say the two events are mutually exclusive at the spawn
    // stage, but the launcher has a `settled` flag for belt-and-suspenders.
    // Verify a stray late 'error' doesn't override the success result.
    const launcher = getLauncher(FAKE_PATH);
    const launchPromise = launcher.launch(PAYLOAD);
    await Promise.resolve();
    await Promise.resolve();

    lastSpawned!.emit('spawn');
    lastSpawned!.emit('error', Object.assign(new Error('late'), { code: 'EACCES' }));

    const result = await launchPromise;
    expect(result).toEqual({ success: true });
  });

  it('does NOT resolve until one of the events fires', async () => {
    const launcher = getLauncher(FAKE_PATH);
    const launchPromise = launcher.launch(PAYLOAD);
    await Promise.resolve();
    await Promise.resolve();

    let settled = false;
    launchPromise.then(() => {
      settled = true;
    });

    // Let several microtasks elapse — promise should still be pending.
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(settled).toBe(false);

    lastSpawned!.emit('spawn');
    await launchPromise;
    expect(settled).toBe(true);
  });
});
