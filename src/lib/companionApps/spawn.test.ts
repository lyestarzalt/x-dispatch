import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { launchCompanionApp, spawnDetached } from './spawn';
import { POWERSHELL_FLAGS } from './startProcess';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));
vi.mock('@/lib/utils/logger', () => ({
  default: { main: { warn: vi.fn(), info: vi.fn() } },
}));

/** A detached child that, on the next tick, reports it started or the errno it was refused with. */
function fakeChild(outcome: { errno?: string } = {}) {
  const child = Object.assign(new EventEmitter(), { unref: vi.fn(), kill: vi.fn() });
  setImmediate(() => {
    if (outcome.errno) {
      child.emit(
        'error',
        Object.assign(new Error(`spawn ${outcome.errno}`), { code: outcome.errno })
      );
    } else {
      child.emit('spawn');
    }
  });
  return child;
}

/** A PowerShell process that writes `stderr`, then closes with `code`. */
function fakePowerShell(outcome: { code: number; stderr?: string }) {
  const stderr = new EventEmitter();
  const child = Object.assign(new EventEmitter(), { stderr, unref: vi.fn(), kill: vi.fn() });
  setImmediate(() => {
    if (outcome.stderr) stderr.emit('data', Buffer.from(outcome.stderr));
    child.emit('close', outcome.code);
  });
  return child;
}

/** Runs `fn` with `process.platform` reading as `platform`. */
async function onPlatform<T>(platform: NodeJS.Platform, fn: () => Promise<T>): Promise<T> {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;
  Object.defineProperty(process, 'platform', { value: platform });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'platform', original);
  }
}

const TMP_ROOT = path.join(os.tmpdir(), `xd-launch-${Date.now()}-${Math.random()}`);
let realExe: string;

beforeAll(() => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  realExe = path.join(TMP_ROOT, 'tool.sh');
  fs.writeFileSync(realExe, '#!/bin/sh\necho ok\n');
  fs.chmodSync(realExe, 0o755);
});

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('spawnDetached', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockImplementation(() => fakeChild() as never);
  });

  it('spawns detached with the parsed args and cwd, and unrefs once started', async () => {
    const child = fakeChild();
    vi.mocked(spawn).mockReturnValueOnce(child as never);
    const result = await spawnDetached({
      exePath: '/usr/bin/foo',
      args: '--start-service --verbose',
      cwd: '/tmp',
    });
    expect(result).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith(
      '/usr/bin/foo',
      ['--start-service', '--verbose'],
      expect.objectContaining({ detached: true, stdio: 'ignore', cwd: '/tmp' })
    );
    expect(child.unref).toHaveBeenCalled();
  });

  it('passes an empty argv when args is missing or blank', async () => {
    await spawnDetached({ exePath: '/usr/bin/foo' });
    expect(spawn).toHaveBeenCalledWith('/usr/bin/foo', [], expect.any(Object));
    vi.mocked(spawn).mockClear();
    await spawnDetached({ exePath: '/usr/bin/foo', args: '   ' });
    expect(spawn).toHaveBeenCalledWith('/usr/bin/foo', [], expect.any(Object));
  });

  it('returns failure when spawn throws synchronously', async () => {
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('EINVAL');
    });
    const result = await spawnDetached({ exePath: '/missing' });
    expect(result).toMatchObject({ success: false, code: 'SPAWN_FAILED' });
    expect(result.error).toContain('EINVAL');
  });

  it.each([
    ['ENOENT', 'FILE_MISSING'],
    ['EACCES', 'ACCESS_DENIED'],
    ['EPERM', 'ACCESS_DENIED'],
    ['EBUSY', 'SPAWN_FAILED'],
  ])('reports an OS refusal with %s as %s', async (errno, code) => {
    vi.mocked(spawn).mockImplementationOnce(() => fakeChild({ errno }) as never);
    const result = await spawnDetached({ exePath: '/usr/bin/foo' });
    expect(result).toMatchObject({ success: false, code });
  });
});

describe('launchCompanionApp on macOS and Linux', () => {
  beforeEach(() => {
    vi.mocked(spawn).mockImplementation(() => fakeChild() as never);
  });

  it('refuses a path that does not exist without spawning', async () => {
    const result = await onPlatform('darwin', () =>
      launchCompanionApp({ exePath: '/totally/not/here' })
    );
    expect(result).toMatchObject({ success: false, code: 'FILE_MISSING' });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('spawns the executable directly', async () => {
    const result = await onPlatform('darwin', () =>
      launchCompanionApp({ exePath: realExe, args: '--foo', cwd: TMP_ROOT })
    );
    expect(result).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith(
      realExe,
      ['--foo'],
      expect.objectContaining({ cwd: TMP_ROOT })
    );
  });
});

describe('launchCompanionApp on Windows', () => {
  const powershell = path.join(TMP_ROOT, 'powershell.exe');

  beforeAll(() => {
    fs.writeFileSync(powershell, '');
  });

  function decodedScript(): string {
    const [, argv] = vi.mocked(spawn).mock.calls[0] as unknown as [string, string[]];
    const encoded = argv[argv.indexOf('-EncodedCommand') + 1] ?? '';
    return Buffer.from(encoded, 'base64').toString('utf16le');
  }

  const launch = (input: Parameters<typeof launchCompanionApp>[0]) =>
    onPlatform('win32', () =>
      launchCompanionApp(input, { powerShellPath: powershell, timeoutMs: 1_000 })
    );

  it('starts the app through Start-Process, so Windows handles elevation, batch files and shortcuts', async () => {
    vi.mocked(spawn).mockImplementationOnce(() => fakePowerShell({ code: 0 }) as never);
    const result = await launch({ exePath: realExe, args: '--port 8086', cwd: TMP_ROOT });
    expect(result).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith(
      powershell,
      [...POWERSHELL_FLAGS, '-EncodedCommand', expect.any(String)],
      expect.objectContaining({ windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] })
    );
    const script = decodedScript();
    expect(script).toContain(`Start-Process -FilePath '${realExe}'`);
    expect(script).toContain(`-WorkingDirectory '${TMP_ROOT}'`);
    expect(script).toContain(`-ArgumentList '"--port"','"8086"'`);
  });

  it('never asks the user to run X-Dispatch as administrator', async () => {
    // An app whose manifest needs administrator rights gets a UAC prompt from
    // Windows itself; X-Dispatch stays a normal process.
    vi.mocked(spawn).mockImplementationOnce(() => fakePowerShell({ code: 0 }) as never);
    const result = await launch({ exePath: realExe });
    expect(result).toEqual({ success: true });
  });

  it.each([
    ['1223 The operation was canceled by the user.', 'CANCELLED'],
    ['5 Access is denied.', 'ACCESS_DENIED'],
    ['2 The system cannot find the file specified.', 'FILE_MISSING'],
    ['-1 Something else.', 'SPAWN_FAILED'],
  ])('reads a refusal "%s" as %s', async (stderr, code) => {
    vi.mocked(spawn).mockImplementationOnce(
      () => fakePowerShell({ code: 1, stderr: `${stderr}\r\n` }) as never
    );
    const result = await launch({ exePath: realExe });
    expect(result).toMatchObject({ success: false, code });
    expect(result.error).toContain(stderr.replace(/^-?\d+ /, ''));
  });

  it('refuses a missing executable before starting PowerShell', async () => {
    const result = await launch({ exePath: 'C:\\nope\\tool.exe' });
    expect(result).toMatchObject({ success: false, code: 'FILE_MISSING' });
    expect(spawn).not.toHaveBeenCalled();
  });

  it('falls back to a direct spawn when PowerShell is not where Windows keeps it', async () => {
    vi.mocked(spawn).mockImplementationOnce(() => fakeChild() as never);
    const result = await onPlatform('win32', () =>
      launchCompanionApp({ exePath: realExe }, { powerShellPath: 'C:\\nope\\powershell.exe' })
    );
    expect(result).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith(realExe, [], expect.objectContaining({ detached: true }));
  });

  it('gives up on a PowerShell that never answers and kills it', async () => {
    const stuck = Object.assign(new EventEmitter(), {
      stderr: new EventEmitter(),
      unref: vi.fn(),
      kill: vi.fn(),
    });
    vi.mocked(spawn).mockImplementationOnce(() => stuck as never);
    const result = await onPlatform('win32', () =>
      launchCompanionApp({ exePath: realExe }, { powerShellPath: powershell, timeoutMs: 20 })
    );
    expect(result).toMatchObject({ success: false, code: 'TIMED_OUT' });
    expect(stuck.kill).toHaveBeenCalled();
  });
});
