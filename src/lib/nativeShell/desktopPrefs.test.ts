import { describe, expect, it } from 'vitest';
import { DEFAULT_DESKTOP_PREFS, parseDesktopPrefs } from './desktopPrefs';

describe('parseDesktopPrefs', () => {
  it('keeps booleans and falls back per field', () => {
    expect(parseDesktopPrefs({ keepRunningOnClose: false, attention: 'yes' })).toEqual({
      ...DEFAULT_DESKTOP_PREFS,
      keepRunningOnClose: false,
    });
  });

  it('returns the defaults for garbage', () => {
    expect(parseDesktopPrefs(null)).toEqual(DEFAULT_DESKTOP_PREFS);
    expect(parseDesktopPrefs('x')).toEqual(DEFAULT_DESKTOP_PREFS);
  });
});
