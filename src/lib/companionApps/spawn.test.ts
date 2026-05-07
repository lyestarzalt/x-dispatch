import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { spawnDetached } from './spawn';

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
  });
});
