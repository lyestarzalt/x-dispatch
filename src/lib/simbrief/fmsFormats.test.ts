import { describe, expect, it } from 'vitest';
import { FMS_FORMATS, getFmsFixedFilename, getFmsFormatLabel } from './fmsFormats';

describe('FMS_FORMATS', () => {
  it('lists exactly 15 curated X-Plane formats', () => {
    expect(FMS_FORMATS).toHaveLength(15);
  });

  it('uses unique keys', () => {
    const keys = FMS_FORMATS.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('includes the canonical X-Plane 12 default', () => {
    expect(FMS_FORMATS.find((f) => f.key === 'xpn')).toBeDefined();
  });
});

describe('getFmsFixedFilename', () => {
  it('returns the required filename for a format that reads a fixed path', () => {
    expect(getFmsFixedFilename('zbo')).toBe('b738x.xml');
  });

  it('returns undefined for formats that accept any filename', () => {
    expect(getFmsFixedFilename('xpn')).toBeUndefined();
  });

  it('returns undefined for an unknown key', () => {
    expect(getFmsFixedFilename('zzz')).toBeUndefined();
  });
});

describe('getFmsFormatLabel', () => {
  it('returns the curated label for a known key', () => {
    expect(getFmsFormatLabel('tfd')).toBe('ToLiss A319/A321/A340');
  });

  it('falls back to the key when unknown', () => {
    expect(getFmsFormatLabel('zzz')).toBe('zzz');
  });
});
