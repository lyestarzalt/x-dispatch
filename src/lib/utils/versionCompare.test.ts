import { describe, expect, it } from 'vitest';
import { hasPrerelease, isNewerVersion, parseSemverTriple } from './versionCompare';

describe('parseSemverTriple', () => {
  it('parses plain semver', () => {
    expect(parseSemverTriple('1.9.0')).toEqual([1, 9, 0]);
    expect(parseSemverTriple('0.0.0')).toEqual([0, 0, 0]);
    expect(parseSemverTriple('10.20.30')).toEqual([10, 20, 30]);
  });

  it('strips leading v', () => {
    expect(parseSemverTriple('v1.9.0')).toEqual([1, 9, 0]);
    expect(parseSemverTriple('v2.0.0')).toEqual([2, 0, 0]);
  });

  it('drops pre-release suffix', () => {
    expect(parseSemverTriple('1.9.0-rc.3')).toEqual([1, 9, 0]);
    expect(parseSemverTriple('v2.0.0-beta.1')).toEqual([2, 0, 0]);
    expect(parseSemverTriple('1.0.0-alpha')).toEqual([1, 0, 0]);
  });

  it('defaults missing segments to 0', () => {
    expect(parseSemverTriple('1')).toEqual([1, 0, 0]);
    expect(parseSemverTriple('1.2')).toEqual([1, 2, 0]);
    expect(parseSemverTriple('')).toEqual([0, 0, 0]);
  });

  it('treats non-numeric segments as 0', () => {
    expect(parseSemverTriple('1.x.0')).toEqual([1, 0, 0]);
    expect(parseSemverTriple('abc.def.ghi')).toEqual([0, 0, 0]);
  });
});

describe('isNewerVersion', () => {
  it('detects newer patch', () => {
    expect(isNewerVersion('1.9.0', '1.9.1')).toBe(true);
    expect(isNewerVersion('1.9.1', '1.9.0')).toBe(false);
  });

  it('detects newer minor', () => {
    expect(isNewerVersion('1.9.0', '1.10.0')).toBe(true);
    expect(isNewerVersion('1.10.0', '1.9.99')).toBe(false);
  });

  it('detects newer major', () => {
    expect(isNewerVersion('1.99.99', '2.0.0')).toBe(true);
    expect(isNewerVersion('2.0.0', '1.99.99')).toBe(false);
  });

  it('returns false for equal versions', () => {
    expect(isNewerVersion('1.9.0', '1.9.0')).toBe(false);
    expect(isNewerVersion('v1.9.0', '1.9.0')).toBe(false);
  });

  it('handles v-prefix on either side', () => {
    expect(isNewerVersion('1.9.0', 'v1.9.1')).toBe(true);
    expect(isNewerVersion('v1.9.0', '1.9.1')).toBe(true);
    expect(isNewerVersion('v1.9.1', 'v1.9.0')).toBe(false);
  });

  it('nudges RC users to stable on same triple', () => {
    expect(isNewerVersion('1.9.0-rc.3', '1.9.0')).toBe(true);
    expect(isNewerVersion('v1.9.0-rc.3', '1.9.0')).toBe(true);
  });

  it('does not flag stable as needing a prerelease', () => {
    expect(isNewerVersion('1.9.0', '1.9.0-rc.3')).toBe(false);
  });

  it('does not nudge between two prereleases on same triple', () => {
    expect(isNewerVersion('1.9.0-rc.1', '1.9.0-rc.3')).toBe(false);
  });

  it('still compares higher core versions regardless of prerelease suffix', () => {
    expect(isNewerVersion('1.9.0-rc.3', '1.9.1')).toBe(true);
    expect(isNewerVersion('1.9.0-rc.3', '2.0.0')).toBe(true);
  });
});

describe('hasPrerelease', () => {
  it('detects pre-release suffix', () => {
    expect(hasPrerelease('1.9.0-rc.3')).toBe(true);
    expect(hasPrerelease('v1.9.0-rc.3')).toBe(true);
    expect(hasPrerelease('1.0.0-alpha')).toBe(true);
  });

  it('returns false for plain semver', () => {
    expect(hasPrerelease('1.9.0')).toBe(false);
    expect(hasPrerelease('v1.9.0')).toBe(false);
  });
});
