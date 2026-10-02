import { describe, expect, it } from 'vitest';
import { formatCursorElevation, formatHeading } from './CompassWidget';

const t = (key: string) => ({ 'units.ft': 'ft', 'units.m': 'm' })[key] ?? key;

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

describe('formatCursorElevation', () => {
  it('shows feet when the altitude preference is ft (single pill, no mixed display)', () => {
    // 1594 m -> ~5,230 ft
    expect(formatCursorElevation(1594, 'ft', t)).toBe('5,230 ft');
  });

  it('shows meters when the altitude preference is m, not feet', () => {
    expect(formatCursorElevation(1594, 'm', t)).toBe('1,594 m');
  });

  it('formats sea level as 0', () => {
    expect(formatCursorElevation(0, 'ft', t)).toBe('0 ft');
  });

  it('handles negative elevations (Dead Sea / Death Valley)', () => {
    // -413 m × 3.28084 ≈ -1,354.99 → -1,355 ft
    expect(formatCursorElevation(-413, 'ft', t)).toBe('-1,355 ft');
  });

  it('uses locale thousands separator for high peaks (Everest fits)', () => {
    // 8848.86 m × 3.28084 ≈ 29,031.69 → 29,032 ft; matches the CLAUDE.md
    // TODO's "9,197 ft" example shape (comma-grouped, single unit).
    expect(formatCursorElevation(8848.86, 'ft', t)).toBe('29,032 ft');
  });
});
