import { describe, expect, it } from 'vitest';
import type { Feet } from '@/lib/utils/geomath';
import { convertLength, formatLength, formatShortDistance } from './length';

const ft = (v: number) => v as Feet;
const t = (key: string) => ({ 'units.ft': 'ft', 'units.m': 'm' })[key] ?? key;

describe('convertLength', () => {
  it('returns the value unchanged for ft', () => {
    expect(convertLength(ft(9397), 'ft')).toBe(9397);
  });

  it('converts ft to metres', () => {
    expect(convertLength(ft(9397), 'm')).toBeCloseTo(2864, 0);
  });
});

describe('formatLength', () => {
  it('formats a runway length in ft with grouping and suffix', () => {
    expect(formatLength(ft(9397), 'ft', t)).toBe('9,397 ft');
  });

  it('formats a runway length in metres', () => {
    expect(formatLength(ft(9397), 'm', t)).toBe('2,864 m');
  });
});

describe('formatShortDistance', () => {
  it('rounds to 10 in the display unit under 1,000', () => {
    expect(formatShortDistance(ft(492), 'ft', t)).toBe('490 ft');
    expect(formatShortDistance(ft(492), 'm', t)).toBe('150 m');
  });

  it('rounds to 50 from 1,000 up', () => {
    expect(formatShortDistance(ft(1234), 'ft', t)).toBe('1,250 ft');
  });
});
