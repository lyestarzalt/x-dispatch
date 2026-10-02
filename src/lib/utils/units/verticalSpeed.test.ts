import { describe, expect, it } from 'vitest';
import type { FeetPerMinute } from './types';
import {
  convertVerticalSpeed,
  formatVerticalSpeed,
  parseVerticalSpeedInput,
} from './verticalSpeed';

const fpm = (v: number) => v as FeetPerMinute;
const t = (key: string) => ({ 'units.fpm': 'fpm', 'units.ms': 'm/s' })[key] ?? key;

describe('convertVerticalSpeed', () => {
  it('returns the value unchanged for fpm', () => {
    expect(convertVerticalSpeed(fpm(2500), 'fpm')).toBe(2500);
  });

  it('converts fpm to m/s', () => {
    expect(convertVerticalSpeed(fpm(2500), 'ms')).toBeCloseTo(12.7, 1);
  });
});

describe('formatVerticalSpeed', () => {
  it('formats fpm as a whole number with suffix', () => {
    expect(formatVerticalSpeed(fpm(2500), 'fpm', t)).toBe('2,500 fpm');
  });

  it('formats m/s with two decimals and suffix', () => {
    expect(formatVerticalSpeed(fpm(2500), 'ms', t)).toBe('12.70 m/s');
  });
});

describe('parseVerticalSpeedInput', () => {
  it('round-trips an m/s input back to canonical fpm', () => {
    expect(parseVerticalSpeedInput(12.7, 'ms')).toBeCloseTo(2500, -1);
  });

  it('returns fpm input unchanged', () => {
    expect(parseVerticalSpeedInput(700, 'fpm')).toBe(700);
  });
});
