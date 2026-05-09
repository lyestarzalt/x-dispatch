import { describe, expect, it } from 'vitest';
import { formatElevationFt, formatHeading } from './CompassWidget';

describe('formatHeading', () => {
  it('pads small bearings to three digits', () => {
    expect(formatHeading(24)).toBe('024');
    expect(formatHeading(0)).toBe('000');
    expect(formatHeading(7)).toBe('007');
  });

  it('keeps three-digit bearings as-is', () => {
    expect(formatHeading(180)).toBe('180');
    expect(formatHeading(359)).toBe('359');
  });

  it('normalizes negative bearings into 0..359 (MapLibre returns -180..180)', () => {
    expect(formatHeading(-45)).toBe('315');
    expect(formatHeading(-180)).toBe('180');
    expect(formatHeading(-1)).toBe('359');
  });

  it('rounds fractional bearings before formatting', () => {
    expect(formatHeading(89.4)).toBe('089');
    expect(formatHeading(89.6)).toBe('090');
  });

  it('wraps 360 to 000 (compass never reads "360°")', () => {
    expect(formatHeading(360)).toBe('000');
  });
});

describe('formatElevationFt', () => {
  it('converts metres to feet, rounded', () => {
    // 1594 m × 3.28084 ≈ 5,229.66 → 5,230 ft
    expect(formatElevationFt(1594)).toBe('5,230');
  });

  it('formats sea level as 0', () => {
    expect(formatElevationFt(0)).toBe('0');
  });

  it('handles negative elevations (Dead Sea / Death Valley)', () => {
    // -413 m × 3.28084 ≈ -1,354.99 → -1,355 ft
    expect(formatElevationFt(-413)).toBe('-1,355');
  });

  it('uses locale thousands separator for high peaks (Everest fits)', () => {
    // 8848.86 m × 3.28084 ≈ 29,031.69 → 29,032 ft
    expect(formatElevationFt(8848.86)).toBe('29,032');
  });
});
