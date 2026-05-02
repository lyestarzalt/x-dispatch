import { describe, expect, it } from 'vitest';
import { isIgnoredFlag } from './ignoreList';

describe('isIgnoredFlag', () => {
  it('returns true for exact Electron debug flags', () => {
    expect(isIgnoredFlag('--inspect')).toBe(true);
    expect(isIgnoredFlag('--inspect-brk')).toBe(true);
    expect(isIgnoredFlag('--remote-debugging-port')).toBe(true);
    expect(isIgnoredFlag('--no-sandbox')).toBe(true);
  });

  it('returns true for Electron flags with =value form', () => {
    expect(isIgnoredFlag('--inspect=9229')).toBe(true);
    expect(isIgnoredFlag('--remote-debugging-port=9222')).toBe(true);
    expect(isIgnoredFlag('--enable-features=Foo')).toBe(true);
  });

  it('returns false for our own flags', () => {
    expect(isIgnoredFlag('--reset-cache')).toBe(false);
    expect(isIgnoredFlag('--xp-arg=--no_sound')).toBe(false);
    expect(isIgnoredFlag('--help')).toBe(false);
    expect(isIgnoredFlag('--version')).toBe(false);
  });

  it('returns false for unrelated flags', () => {
    expect(isIgnoredFlag('--rest-cache')).toBe(false);
    expect(isIgnoredFlag('--unknown')).toBe(false);
  });

  it('does not match flags with same prefix but different suffix', () => {
    expect(isIgnoredFlag('--no-sandbox-please')).toBe(false);
  });
});
