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

// Elevation drives the EACCES classification, so it has to be controllable.
// The real implementation shells out to `fltmc`, which the child_process mock
// below doesn't provide anyway.
const isElevatedMock = vi.fn(() => false);
vi.mock('@/lib/utils/isElevated', () => ({
  isElevated: () => isElevatedMock(),
}));

// Sentry: the error path opens a scope to attach launch diagnostics. Run the
// callback so the scope calls are exercised, but keep it inert.
vi.mock('@sentry/electron/main', () => ({
  withScope: (fn: (scope: { setContext: () => void }) => void) => fn({ setContext: () => {} }),
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

const { getLauncher, classifySpawnError } = await import('./index');

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_PATH = '/Users/test/X-Plane 12';
// Minimal payload — only fields the launcher actually reads end up mattering,
// and at this layer it's mostly opaque (`buildFlightInit` is done upstream).
const PAYLOAD = {} as unknown as Parameters<ReturnType<typeof getLauncher>['launch']>[0];

const REAL_PLATFORM = process.platform;

/** Classification branches on the host OS, so pin it rather than inherit CI's. */
function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

beforeEach(() => {
  lastSpawned = null;
  spawnMock.mockClear();
  isElevatedMock.mockReturnValue(false);
});

afterEach(() => {
  setPlatform(REAL_PLATFORM);
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

  it('classifies an EACCES refusal as NEEDS_ADMIN on un-elevated Windows', async () => {
    setPlatform('win32');
    isElevatedMock.mockReturnValue(false);
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
      code: 'NEEDS_ADMIN',
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
    expect(result.code).toBe('EXE_NOT_FOUND');
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
    // No errno to go on, but the renderer still gets a code it can switch on —
    // it falls back to the raw message for SPAWN_FAILED.
    expect(result.code).toBe('SPAWN_FAILED');
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

describe('classifySpawnError', () => {
  it('reports a missing executable regardless of platform or elevation', () => {
    expect(classifySpawnError('ENOENT', { platform: 'win32', elevated: false })).toBe(
      'EXE_NOT_FOUND'
    );
    expect(classifySpawnError('ENOENT', { platform: 'darwin', elevated: true })).toBe(
      'EXE_NOT_FOUND'
    );
  });

  it.each(['EACCES', 'EPERM'])(
    'treats %s on un-elevated Windows as possibly needing admin',
    (errno) => {
      expect(classifySpawnError(errno, { platform: 'win32', elevated: false })).toBe('NEEDS_ADMIN');
    }
  );

  it.each(['EACCES', 'EPERM'])(
    'rules elevation out for %s when Windows already refused us as admin',
    (errno) => {
      // libuv maps both ERROR_ELEVATION_REQUIRED (740) and ERROR_ACCESS_DENIED
      // (5) to EACCES. Being elevated already eliminates the former, so what
      // is left is antivirus / ACLs — and "run as administrator" would be
      // actively misleading advice.
      expect(classifySpawnError(errno, { platform: 'win32', elevated: true })).toBe(
        'ACCESS_BLOCKED'
      );
    }
  );

  it.each(['darwin', 'linux'] as const)(
    'never suggests admin on %s, where there is no UAC',
    (platform) => {
      expect(classifySpawnError('EACCES', { platform, elevated: false })).toBe('ACCESS_BLOCKED');
      expect(classifySpawnError('EACCES', { platform, elevated: true })).toBe('ACCESS_BLOCKED');
    }
  );

  it.each([undefined, 'EBUSY', 'EMFILE', 'UNKNOWN'])(
    'falls back to SPAWN_FAILED for unrecognised errno %s',
    (errno) => {
      expect(classifySpawnError(errno, { platform: 'win32', elevated: false })).toBe(
        'SPAWN_FAILED'
      );
    }
  );
});
