import { describe, expect, it } from 'vitest';
import type { NauticalMiles } from '@/lib/utils/geomath';
import { convertDistance, formatDistance, parseDistanceInput } from './distance';

const nm = (v: number) => v as NauticalMiles;
const t = (key: string) => ({ 'units.nm': 'NM', 'units.km': 'km', 'units.mi': 'mi' })[key] ?? key;

describe('convertDistance', () => {
  it('returns the value unchanged for nm', () => {
    expect(convertDistance(nm(100), 'nm')).toBe(100);
  });

  it('converts nm to km', () => {
    expect(convertDistance(nm(100), 'km')).toBeCloseTo(185.2, 1);
  });

  it('converts nm to statute miles', () => {
    expect(convertDistance(nm(100), 'mi')).toBeCloseTo(115.08, 1);
  });
});

describe('formatDistance', () => {
  it('formats nm with the unit suffix, always to one decimal', () => {
    expect(formatDistance(nm(250), 'nm', t)).toBe('250.0 NM');
  });

  it('formats small values with an extra decimal instead of rounding to zero', () => {
    expect(formatDistance(nm(0.4), 'nm', t)).toBe('0.4 NM');
  });

  it('formats km with the unit suffix', () => {
    expect(formatDistance(nm(100), 'km', t)).toBe('185.2 km');
  });
});

describe('parseDistanceInput', () => {
  it('round-trips a km input back to canonical nm', () => {
    const result = parseDistanceInput(185.2, 'km');
    expect(result).toBeCloseTo(100, 0);
  });

  it('returns nm input unchanged', () => {
    expect(parseDistanceInput(42, 'nm')).toBe(42);
  });
});
