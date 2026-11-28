import { describe, expect, it } from 'vitest';
import { formatCoordinates, formatInsCoordinates } from './coordinates';

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

  // 45.99999° is 45°59.9994': rounded, the minutes must carry into the degree.
  it('carries rounded minutes into the next degree', () => {
    expect(formatCoordinates(45.99999, -7.99999, 'dm', t)).toBe(`N46°0.00' W8°0.00'`);
    expect(formatCoordinates(45.99999, -7.99999, 'dms', t)).toBe(`N46°0'0" W8°0'0"`);
  });

  it('carries rounded seconds into the next minute', () => {
    // 10.0166666° = 10°0'59.99..."
    expect(formatCoordinates(10.0166666, 20, 'dms', t)).toBe(`N10°1'0" E20°0'0"`);
  });
});

describe('formatInsCoordinates', () => {
  it('writes padded degrees and minutes to a tenth, hemisphere first', () => {
    expect(formatInsCoordinates(43.6653, 7.215)).toBe(`N43°39.9' E007°12.9'`);
    expect(formatInsCoordinates(-33.8688, -151.2093)).toBe(`S33°52.1' W151°12.6'`);
    expect(formatInsCoordinates(5.5, -0.75)).toBe(`N05°30.0' W000°45.0'`);
  });

  it('carries a rounded 60.0 minutes into the degree', () => {
    expect(formatInsCoordinates(45.99999, -7.99999)).toBe(`N46°00.0' W008°00.0'`);
  });

  it('writes a value that rounds to zero as north/east', () => {
    expect(formatInsCoordinates(-0.00001, -0.00001)).toBe(`N00°00.0' E000°00.0'`);
  });
});
