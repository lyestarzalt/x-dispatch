import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as canExecuteModule from '@/lib/utils/canExecute';
import * as isElevatedModule from '@/lib/utils/isElevated';
import { launchCompanionApp, spawnDetached } from './spawn';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));
vi.mock('@/lib/utils/logger', () => ({
  default: { main: { warn: vi.fn(), info: vi.fn() } },
}));

describe('spawnDetached', () => {
  let fakeChild: EventEmitter & { unref: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    fakeChild = Object.assign(new EventEmitter(), { unref: vi.fn() });
    vi.mocked(spawn).mockReturnValue(fakeChild as never);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('spawns with the right exePath, parsed args, and cwd', () => {
    spawnDetached({
      exePath: '/usr/bin/foo',
      args: '--start-service --verbose',
      cwd: '/tmp',
    });
    expect(spawn).toHaveBeenCalledWith(
      '/usr/bin/foo',
      ['--start-service', '--verbose'],
      expect.objectContaining({ detached: true, stdio: 'ignore', cwd: '/tmp' })
    );
  });

  it('passes an empty argv when args is missing or blank', () => {
    spawnDetached({ exePath: '/usr/bin/foo' });
    expect(spawn).toHaveBeenCalledWith('/usr/bin/foo', [], expect.any(Object));

    vi.mocked(spawn).mockClear();
    spawnDetached({ exePath: '/usr/bin/foo', args: '   ' });
    expect(spawn).toHaveBeenCalledWith('/usr/bin/foo', [], expect.any(Object));
  });

  it('returns success when spawn succeeds and calls unref', () => {
    const result = spawnDetached({ exePath: '/usr/bin/foo' });
    expect(result).toEqual({ success: true });
    expect(fakeChild.unref).toHaveBeenCalled();
  });

  it('returns failure when spawn throws synchronously', () => {
    vi.mocked(spawn).mockImplementationOnce(() => {
      throw new Error('ENOENT: no such file');
    });
    const result = spawnDetached({ exePath: '/missing' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('ENOENT');
    expect(result.code).toBe('SPAWN_FAILED');
  });
});

describe('launchCompanionApp', () => {
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

  beforeEach(() => {
    const fakeChild = Object.assign(new EventEmitter(), { unref: vi.fn() });
    vi.mocked(spawn).mockReturnValue(fakeChild as never);
    vi.spyOn(isElevatedModule, 'isElevated').mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('refuses to spawn with NEEDS_ADMIN when not elevated', () => {
    if (process.platform !== 'win32') return; // elevation check only on Windows
    vi.spyOn(isElevatedModule, 'isElevated').mockReturnValue(false);
    const result = launchCompanionApp({ exePath: realExe });
    expect(result.success).toBe(false);
    expect(result.code).toBe('NEEDS_ADMIN');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('refuses to spawn with FILE_MISSING when path does not exist', () => {
    // Skip on Windows where non-elevated users see FILE_MISSING through elevation check
    if (process.platform === 'win32') {
      vi.spyOn(isElevatedModule, 'isElevated').mockReturnValue(true);
    }
    const result = launchCompanionApp({ exePath: '/totally/not/here' });
    expect(result.success).toBe(false);
    expect(result.code).toBe('FILE_MISSING');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('refuses to spawn with FILE_NOT_EXECUTABLE on POSIX when no x bit', () => {
    if (process.platform === 'win32') return; // semantics differ; covered by canExecute tests
    const noX = path.join(TMP_ROOT, 'no-x');
    fs.writeFileSync(noX, 'plain');
    fs.chmodSync(noX, 0o644);
    const result = launchCompanionApp({ exePath: noX });
    expect(result.success).toBe(false);
    expect(result.code).toBe('FILE_NOT_EXECUTABLE');
    expect(spawn).not.toHaveBeenCalled();
  });

  it('spawns when elevated and executable', () => {
    const result = launchCompanionApp({ exePath: realExe, args: '--foo --bar', cwd: TMP_ROOT });
    expect(result).toEqual({ success: true });
    expect(spawn).toHaveBeenCalledWith(
      realExe,
      ['--foo', '--bar'],
      expect.objectContaining({ detached: true, stdio: 'ignore', cwd: TMP_ROOT })
    );
  });

  it('checks elevation before access (single source of error code)', () => {
    if (process.platform !== 'win32') return; // elevation check only on Windows
    vi.spyOn(isElevatedModule, 'isElevated').mockReturnValue(false);
    const accessSpy = vi.spyOn(canExecuteModule, 'canExecute');
    launchCompanionApp({ exePath: '/totally/not/here' });
    expect(accessSpy).not.toHaveBeenCalled();
  });
});
