import { afterEach, describe, expect, it, vi } from 'vitest';
import { _resetElevationCache, detectElevation, isElevated } from './isElevated';

describe('detectElevation', () => {
  it('returns true on linux when euid is 0', () => {
    expect(detectElevation({ platform: 'linux', geteuid: () => 0 })).toBe(true);
  });

  it('returns false on linux when euid is non-zero', () => {
    expect(detectElevation({ platform: 'linux', geteuid: () => 1000 })).toBe(false);
  });

  it('returns true on darwin when euid is 0', () => {
    expect(detectElevation({ platform: 'darwin', geteuid: () => 0 })).toBe(true);
  });

  it('returns false on darwin when geteuid is missing', () => {
    expect(detectElevation({ platform: 'darwin' })).toBe(false);
  });

  it('returns true on win32 when windowsCheck returns true', () => {
    expect(detectElevation({ platform: 'win32', windowsCheck: () => true })).toBe(true);
  });

  it('returns false on win32 when windowsCheck returns false', () => {
    expect(detectElevation({ platform: 'win32', windowsCheck: () => false })).toBe(false);
  });

  it('ignores geteuid on win32', () => {
    // Even if geteuid somehow returned 0 on Windows (it shouldn't), the
    // windowsCheck path should still drive the answer.
    expect(
      detectElevation({ platform: 'win32', geteuid: () => 0, windowsCheck: () => false })
    ).toBe(false);
  });
});

describe('isElevated (cached)', () => {
  afterEach(() => {
    _resetElevationCache();
    vi.unstubAllGlobals();
  });

  it('caches the first result and reuses it on subsequent calls', () => {
    // Stub geteuid before first call so detection sees a non-root uid.
    const spy = vi.fn(() => 1000);
    vi.stubGlobal('process', { ...process, geteuid: spy });
    const first = isElevated();
    expect(first).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);

    // Even if the underlying check would now report differently, the cache
    // must hold the first answer.
    spy.mockReturnValue(0);
    const second = isElevated();
    expect(second).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('recomputes after _resetElevationCache', () => {
    const spy = vi.fn(() => 1000);
    vi.stubGlobal('process', { ...process, geteuid: spy });
    expect(isElevated()).toBe(false);

    _resetElevationCache();
    spy.mockReturnValue(0);
    expect(isElevated()).toBe(true);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
