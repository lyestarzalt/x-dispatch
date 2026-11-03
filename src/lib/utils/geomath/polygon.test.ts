import { describe, expect, it } from 'vitest';
import { isPointInPolygon } from './polygon';

// A square around the origin, unclosed (last vertex ≠ first) like atc.dat rings.
const SQUARE: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

describe('isPointInPolygon', () => {
  it('contains interior points and excludes exterior ones', () => {
    expect(isPointInPolygon([0, 0], SQUARE)).toBe(true);
    expect(isPointInPolygon([0.9, -0.9], SQUARE)).toBe(true);
    expect(isPointInPolygon([2, 0], SQUARE)).toBe(false);
    expect(isPointInPolygon([0, -2], SQUARE)).toBe(false);
  });

  it('handles a concave ring', () => {
    // A "C" shape: the notch on the right is outside.
    const cShape: [number, number][] = [
      [0, 0],
      [4, 0],
      [4, 1],
      [1, 1],
      [1, 3],
      [4, 3],
      [4, 4],
      [0, 4],
    ];
    expect(isPointInPolygon([0.5, 2], cShape)).toBe(true);
    expect(isPointInPolygon([3, 2], cShape)).toBe(false);
  });

  it('handles a ring that crosses the antimeridian', () => {
    // 170°E → 170°W, 10°S → 10°N: a box straddling 180°.
    const pacific: [number, number][] = [
      [170, -10],
      [-170, -10],
      [-170, 10],
      [170, 10],
    ];
    expect(isPointInPolygon([179, 0], pacific)).toBe(true);
    expect(isPointInPolygon([-179, 0], pacific)).toBe(true);
    expect(isPointInPolygon([0, 0], pacific)).toBe(false);
    expect(isPointInPolygon([-77, 0], pacific)).toBe(false);
  });

  it('rejects degenerate rings', () => {
    expect(isPointInPolygon([0, 0], [])).toBe(false);
    expect(
      isPointInPolygon(
        [0, 0],
        [
          [0, 0],
          [1, 1],
        ]
      )
    ).toBe(false);
  });
});
