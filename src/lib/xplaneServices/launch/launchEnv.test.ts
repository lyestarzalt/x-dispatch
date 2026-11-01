import { describe, expect, it } from 'vitest';
import { buildLaunchEnv, isValidEnvName, parseLaunchEnv } from './launchEnv';

describe('isValidEnvName', () => {
  it('accepts shell-style names and rejects the rest', () => {
    expect(isValidEnvName('NVPRESENT_ENABLE_SMOOTH_MOTION')).toBe(true);
    expect(isValidEnvName('_x1')).toBe(true);
    expect(isValidEnvName('1ABC')).toBe(false);
    expect(isValidEnvName('WITH SPACE')).toBe(false);
    expect(isValidEnvName('A=B')).toBe(false);
    expect(isValidEnvName('')).toBe(false);
  });
});

describe('parseLaunchEnv', () => {
  it('keeps well-formed entries and drops broken ones', () => {
    expect(
      parseLaunchEnv([
        { name: 'NVPRESENT_ENABLE_SMOOTH_MOTION', value: '1' },
        { name: ' PADDED ', value: 'x' },
        { name: 'bad name', value: '1' },
        { name: 'NO_VALUE' },
        'junk',
        null,
      ])
    ).toEqual({ NVPRESENT_ENABLE_SMOOTH_MOTION: '1', PADDED: 'x' });
  });

  it('lets a later duplicate win', () => {
    expect(
      parseLaunchEnv([
        { name: 'A', value: '1' },
        { name: 'A', value: '2' },
      ])
    ).toEqual({ A: '2' });
  });

  it('returns nothing for anything that is not a list', () => {
    expect(parseLaunchEnv(undefined)).toEqual({});
    expect(parseLaunchEnv({ name: 'A', value: '1' })).toEqual({});
  });
});

describe('buildLaunchEnv', () => {
  it('layers the custom variables over the process environment', () => {
    expect(buildLaunchEnv({ PATH: '/bin', HOME: '/h' }, { HOME: '/other', NEW: '1' })).toEqual({
      PATH: '/bin',
      HOME: '/other',
      NEW: '1',
    });
  });
});
