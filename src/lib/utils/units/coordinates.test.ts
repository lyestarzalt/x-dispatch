import { describe, expect, it } from 'vitest';
import { formatCoordinates } from './coordinates';

const t = (key: string) =>
  ({ 'directions.n': 'N', 'directions.s': 'S', 'directions.e': 'E', 'directions.w': 'W' })[key] ??
  key;

describe('formatCoordinates', () => {
  it('formats decimal degrees with hemisphere letters', () => {
    expect(formatCoordinates(43.6653, 7.215, 'decimal', t)).toBe('43.6653°N 7.2150°E');
  });

  it('formats negative latitude/longitude with the correct hemisphere letters', () => {
    expect(formatCoordinates(-33.8688, -151.2093, 'decimal', t)).toBe('33.8688°S 151.2093°W');
  });

  it('formats degrees/minutes/seconds', () => {
    expect(formatCoordinates(43.6653, 7.215, 'dms', t)).toBe(`N43°39'55" E7°12'54"`);
  });

  it('formats degrees + decimal minutes', () => {
    expect(formatCoordinates(43.6653, 7.215, 'dm', t)).toBe(`N43°39.92' E7°12.90'`);
  });
});
