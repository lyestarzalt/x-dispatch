import { describe, expect, it } from 'vitest';
import type { Feet } from '@/lib/utils/geomath';
import {
  convertAltitude,
  formatAltitude,
  formatShortDistance,
  parseAltitudeInput,
} from './altitude';

const ft = (v: number) => v as Feet;
const t = (key: string) => ({ 'units.ft': 'ft', 'units.m': 'm' })[key] ?? key;

describe('convertAltitude', () => {
  it('returns the value unchanged for ft', () => {
    expect(convertAltitude(ft(9197), 'ft')).toBe(9197);
  });

  it('converts ft to meters', () => {
    expect(convertAltitude(ft(9197), 'm')).toBeCloseTo(2803, 0);
  });
});

describe('formatAltitude', () => {
  it('formats ft with grouping and suffix', () => {
    expect(formatAltitude(ft(9197), 'ft', t)).toBe('9,197 ft');
  });

  it('formats meters with grouping and suffix', () => {
    expect(formatAltitude(ft(9197), 'm', t)).toBe('2,803 m');
  });
});

describe('parseAltitudeInput', () => {
  it('round-trips a meter input back to canonical feet', () => {
    expect(parseAltitudeInput(2803, 'm')).toBeCloseTo(9196, 0);
  });

  it('returns ft input unchanged', () => {
    expect(parseAltitudeInput(5000, 'ft')).toBe(5000);
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
