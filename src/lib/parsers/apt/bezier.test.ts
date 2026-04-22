import { describe, expect, it } from 'vitest';
import type { LonLat } from '@/types/geo';
import {
  DEFAULT_BEZIER_RESOLUTION,
  calculateBezier,
  calculateCubicBezier,
  mirrorControlPoint,
} from './bezier';

// ---------------------------------------------------------------------------
// calculateBezier (quadratic)
// ---------------------------------------------------------------------------

describe('calculateBezier', () => {
  it('has DEFAULT_BEZIER_RESOLUTION = 60', () => {
    expect(DEFAULT_BEZIER_RESOLUTION).toBe(60);
  });

  it('first point equals p0 and last point equals p2', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [5, 5];
    const p2: LonLat = [10, 0];
    const points = calculateBezier(p0, p1, p2, 10);

    expect(points[0]![0]).toBeCloseTo(p0[0], 10);
    expect(points[0]![1]).toBeCloseTo(p0[1], 10);
    expect(points[points.length - 1]![0]).toBeCloseTo(p2[0], 10);
    expect(points[points.length - 1]![1]).toBeCloseTo(p2[1], 10);
  });

  it('with collinear control point produces a nearly straight line', () => {
    // p1 is the midpoint between p0 and p2 → degenerate quadratic = straight line
    const p0: LonLat = [0, 0];
    const p1: LonLat = [5, 0];
    const p2: LonLat = [10, 0];
    const points = calculateBezier(p0, p1, p2, 10);

    for (const pt of points) {
      // All points should lie on y=0
      expect(pt[1]).toBeCloseTo(0, 10);
      // x should increase from 0 to 10
      expect(pt[0]).toBeGreaterThanOrEqual(-1e-10);
      expect(pt[0]).toBeLessThanOrEqual(10 + 1e-10);
    }
  });

  it('resolution=5 produces 6 points (0..5 inclusive)', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [5, 5];
    const p2: LonLat = [10, 0];
    const points = calculateBezier(p0, p1, p2, 5);
    expect(points).toHaveLength(6);
  });

  it('resolution=10 produces 11 points', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [5, 5];
    const p2: LonLat = [10, 0];
    const points = calculateBezier(p0, p1, p2, 10);
    expect(points).toHaveLength(11);
  });

  it('resolution=1 produces 2 points (start and end only)', () => {
    const p0: LonLat = [1, 2];
    const p1: LonLat = [3, 4];
    const p2: LonLat = [5, 6];
    const points = calculateBezier(p0, p1, p2, 1);
    expect(points).toHaveLength(2);
    expect(points[0]![0]).toBeCloseTo(p0[0], 10);
    expect(points[0]![1]).toBeCloseTo(p0[1], 10);
    expect(points[1]![0]).toBeCloseTo(p2[0], 10);
    expect(points[1]![1]).toBeCloseTo(p2[1], 10);
  });

  it('intermediate points form a curve (off the straight line)', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [5, 10]; // Control point pulls upward
    const p2: LonLat = [10, 0];
    const points = calculateBezier(p0, p1, p2, 10);

    // The midpoint at t=0.5:
    // B(0.5) = (1-0.5)^2 * p0 + 2*(1-0.5)*0.5 * p1 + 0.5^2 * p2
    //        = 0.25*[0,0] + 0.5*[5,10] + 0.25*[10,0]
    //        = [0,0] + [2.5, 5] + [2.5, 0] = [5, 5]
    const mid = points[5]!;
    expect(mid[0]).toBeCloseTo(5, 5);
    expect(mid[1]).toBeCloseTo(5, 5);
  });
});

// ---------------------------------------------------------------------------
// calculateCubicBezier
// ---------------------------------------------------------------------------

describe('calculateCubicBezier', () => {
  it('first point equals p0 and last point equals p3', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [2, 8];
    const p2: LonLat = [8, 8];
    const p3: LonLat = [10, 0];
    const points = calculateCubicBezier(p0, p1, p2, p3, 10);

    expect(points[0]![0]).toBeCloseTo(p0[0], 10);
    expect(points[0]![1]).toBeCloseTo(p0[1], 10);
    expect(points[points.length - 1]![0]).toBeCloseTo(p3[0], 10);
    expect(points[points.length - 1]![1]).toBeCloseTo(p3[1], 10);
  });

  it('resolution=5 produces 6 points', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [2, 8];
    const p2: LonLat = [8, 8];
    const p3: LonLat = [10, 0];
    const points = calculateCubicBezier(p0, p1, p2, p3, 5);
    expect(points).toHaveLength(6);
  });

  it('resolution=10 produces 11 points', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [2, 8];
    const p2: LonLat = [8, 8];
    const p3: LonLat = [10, 0];
    const points = calculateCubicBezier(p0, p1, p2, p3, 10);
    expect(points).toHaveLength(11);
  });

  it('S-curve: midpoint at t=0.5 lies between p1 and p2 in y-direction', () => {
    // Symmetric S-curve: p1 is above, p2 is below baseline
    const p0: LonLat = [0, 0];
    const p1: LonLat = [3, 6];
    const p2: LonLat = [7, -6];
    const p3: LonLat = [10, 0];
    const points = calculateCubicBezier(p0, p1, p2, p3, 10);

    // B(0.5) with cubic = 0.125*p0 + 0.375*p1 + 0.375*p2 + 0.125*p3
    // = 0.125*[0,0] + 0.375*[3,6] + 0.375*[7,-6] + 0.125*[10,0]
    // = [0,0] + [1.125, 2.25] + [2.625, -2.25] + [1.25, 0] = [5, 0]
    const mid = points[5]!;
    expect(mid[0]).toBeCloseTo(5, 5);
    expect(mid[1]).toBeCloseTo(0, 5);
  });

  it('straight line: collinear control points stay on the line', () => {
    const p0: LonLat = [0, 0];
    const p1: LonLat = [3.33, 0];
    const p2: LonLat = [6.67, 0];
    const p3: LonLat = [10, 0];
    const points = calculateCubicBezier(p0, p1, p2, p3, 10);

    for (const pt of points) {
      expect(pt[1]).toBeCloseTo(0, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// mirrorControlPoint
// ---------------------------------------------------------------------------

describe('mirrorControlPoint', () => {
  it('mirrors [1,1] around [0,0] to [-1,-1]', () => {
    const result = mirrorControlPoint([0, 0], [1, 1]);
    expect(result[0]).toBeCloseTo(-1, 10);
    expect(result[1]).toBeCloseTo(-1, 10);
  });

  it('mirrors [3,3] around [5,5] to [7,7]', () => {
    const result = mirrorControlPoint([5, 5], [3, 3]);
    expect(result[0]).toBeCloseTo(7, 10);
    expect(result[1]).toBeCloseTo(7, 10);
  });

  it('control point equals vertex returns vertex (degenerate case)', () => {
    const vertex: LonLat = [3, 4];
    const result = mirrorControlPoint(vertex, vertex);
    expect(result[0]).toBeCloseTo(3, 10);
    expect(result[1]).toBeCloseTo(4, 10);
  });

  it('mirrors along one axis only', () => {
    // vertex [0, 0], control [5, 0] → mirror = [-5, 0]
    const result = mirrorControlPoint([0, 0], [5, 0]);
    expect(result[0]).toBeCloseTo(-5, 10);
    expect(result[1]).toBeCloseTo(0, 10);
  });

  it('result is equidistant from vertex as the control point', () => {
    const vertex: LonLat = [2, 3];
    const control: LonLat = [5, 7];
    const result = mirrorControlPoint(vertex, control);
    const dOriginal = Math.hypot(control[0] - vertex[0], control[1] - vertex[1]);
    const dMirror = Math.hypot(result[0] - vertex[0], result[1] - vertex[1]);
    expect(dMirror).toBeCloseTo(dOriginal, 10);
  });
});
