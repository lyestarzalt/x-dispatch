import { beforeEach, describe, expect, it } from 'vitest';
import { __resetCliFlagsForTest, getCliFlags, setCliFlags } from './state';

describe('CLI state singleton', () => {
  beforeEach(() => {
    __resetCliFlagsForTest();
  });

  it('returns defaults before set', () => {
    const flags = getCliFlags();
    expect(flags).toEqual({
      help: false,
      version: false,
      resetCache: false,
      xpArgs: [],
    });
  });

  it('stores frozen flags after set', () => {
    setCliFlags({
      help: false,
      version: false,
      resetCache: true,
      xpArgs: ['--no_sound'],
    });
    const flags = getCliFlags();
    expect(flags.resetCache).toBe(true);
    expect(flags.xpArgs).toEqual(['--no_sound']);
    expect(Object.isFrozen(flags)).toBe(true);
    expect(Object.isFrozen(flags.xpArgs)).toBe(true);
  });

  it('throws if set twice', () => {
    setCliFlags({ help: false, version: false, resetCache: false, xpArgs: [] });
    expect(() =>
      setCliFlags({ help: false, version: false, resetCache: false, xpArgs: [] })
    ).toThrow(/already set/);
  });
});
