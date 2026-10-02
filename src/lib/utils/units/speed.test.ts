import { describe, expect, it } from 'vitest';
import { convertSpeed, formatSpeed, parseSpeedInput } from './speed';
import type { Knots } from './types';

const kts = (v: number) => v as Knots;
const t = (key: string) =>
  ({ 'units.kts': 'kts', 'units.kmh': 'km/h', 'units.mph': 'mph' })[key] ?? key;

describe('convertSpeed', () => {
  it('returns the value unchanged for kts', () => {
    expect(convertSpeed(kts(280), 'kts')).toBe(280);
  });

  it('converts kts to km/h', () => {
    expect(convertSpeed(kts(280), 'kmh')).toBeCloseTo(518.6, 0);
  });

  it('converts kts to mph', () => {
    expect(convertSpeed(kts(280), 'mph')).toBeCloseTo(322.2, 0);
  });
});

describe('formatSpeed', () => {
  it('formats kts as a whole number with suffix', () => {
    expect(formatSpeed(kts(280), 'kts', t)).toBe('280 kts');
  });

  it('formats km/h with suffix', () => {
    expect(formatSpeed(kts(280), 'kmh', t)).toBe('519 km/h');
  });
});

describe('parseSpeedInput', () => {
  it('round-trips a km/h input back to canonical knots', () => {
    expect(parseSpeedInput(518.6, 'kmh')).toBeCloseTo(280, 0);
  });

  it('returns kts input unchanged', () => {
    expect(parseSpeedInput(150, 'kts')).toBe(150);
  });
});
