import { describe, expect, it } from 'vitest';
import type { LonLat } from '@/types/geo';
import {
  DEFAULT_CHORD_TOLERANCE_M,
  calculateBezier,
  calculateCubicBezier,
  cubicSegmentCount,
  mirrorControlPoint,
  quadraticSegmentCount,
  setBezierChordTolerance,
} from './bezier';

/** Metres per degree at the test latitude, for building curves of a known size. */
const TEST_LAT = 49.0;
const M_PER_DEG_LAT = 111320;
const M_PER_DEG_LON = M_PER_DEG_LAT * Math.cos((TEST_LAT * Math.PI) / 180);

/** A point `east` and `north` metres from the test origin, as [lon, lat]. */
function metres(east: number, north: number): LonLat {
  return [2.5 + east / M_PER_DEG_LON, TEST_LAT + north / M_PER_DEG_LAT];
}

function toMetres(p: LonLat): [number, number] {
  return [(p[0] - 2.5) * M_PER_DEG_LON, (p[1] - TEST_LAT) * M_PER_DEG_LAT];
}

function pointToSegmentM(p: LonLat, a: LonLat, b: LonLat): number {
  const [px, py] = toMetres(p);
  const [ax, ay] = toMetres(a);
  const [bx, by] = toMetres(b);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Largest distance from any point of the dense curve to the flattened polyline, in metres. */
function maxDeviationM(dense: LonLat[], polyline: LonLat[]): number {
  let worst = 0;
  for (const p of dense) {
    let best = Infinity;
    for (let i = 1; i < polyline.length; i++) {
      best = Math.min(best, pointToSegmentM(p, polyline[i - 1]!, polyline[i]!));
    }
    worst = Math.max(worst, best);
  }
  return worst;
}

// ---------------------------------------------------------------------------
// calculateBezier (quadratic)
// ---------------------------------------------------------------------------

describe('calculateBezier', () => {
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

// ---------------------------------------------------------------------------
// Adaptive flattening — the default resolution follows the chord error
// ---------------------------------------------------------------------------

describe('adaptive flattening', () => {
  it('defaults to a 0.1 m chord tolerance', () => {
    expect(DEFAULT_CHORD_TOLERANCE_M).toBe(0.1);
  });

  it('a 3 m fillet needs only a handful of points', () => {
    const p0 = metres(0, 0);
    const p1 = metres(3, 0);
    const p2 = metres(3, 3);
    const points = calculateBezier(p0, p1, p2);
    expect(points.length).toBeLessThanOrEqual(8);
    expect(points.length).toBeGreaterThanOrEqual(3);
  });

  it('a 3 m fillet stays within tolerance of the dense curve', () => {
    const p0 = metres(0, 0);
    const p1 = metres(3, 0);
    const p2 = metres(3, 3);
    const dense = calculateBezier(p0, p1, p2, 2000);
    expect(maxDeviationM(dense, calculateBezier(p0, p1, p2))).toBeLessThan(
      DEFAULT_CHORD_TOLERANCE_M
    );
  });

  it('a 200 m arc stays within tolerance of the dense curve', () => {
    const p0 = metres(0, 0);
    const p1 = metres(200, 0);
    const p2 = metres(200, 200);
    const dense = calculateBezier(p0, p1, p2, 2000);
    const points = calculateBezier(p0, p1, p2);
    expect(points.length).toBeGreaterThan(10);
    expect(maxDeviationM(dense, points)).toBeLessThan(DEFAULT_CHORD_TOLERANCE_M);
  });

  it('a 100 m cubic S-curve stays within tolerance of the dense curve', () => {
    const p0 = metres(0, 0);
    const p1 = metres(30, 40);
    const p2 = metres(70, -40);
    const p3 = metres(100, 0);
    const dense = calculateCubicBezier(p0, p1, p2, p3, 2000);
    const points = calculateCubicBezier(p0, p1, p2, p3);
    expect(points.length).toBeGreaterThan(10);
    expect(maxDeviationM(dense, points)).toBeLessThan(DEFAULT_CHORD_TOLERANCE_M);
  });

  it('evenly spaced collinear control points produce a single straight chord', () => {
    expect(calculateBezier(metres(0, 0), metres(50, 0), metres(100, 0))).toHaveLength(2);
    expect(
      calculateCubicBezier(metres(0, 0), metres(100 / 3, 0), metres(200 / 3, 0), metres(100, 0))
    ).toHaveLength(2);
  });

  it('start and end points are the exact curve endpoints', () => {
    const p0 = metres(0, 0);
    const p1 = metres(20, 5);
    const p2 = metres(20, 25);
    const points = calculateBezier(p0, p1, p2);
    expect(points[0]).toEqual(p0);
    expect(points[points.length - 1]).toEqual(p2);
  });

  it('segment count grows with curve size and shrinks with tolerance', () => {
    const small = quadraticSegmentCount(metres(0, 0), metres(3, 0), metres(3, 3));
    const large = quadraticSegmentCount(metres(0, 0), metres(200, 0), metres(200, 200));
    expect(large).toBeGreaterThan(small);
    expect(quadraticSegmentCount(metres(0, 0), metres(200, 0), metres(200, 200), 1)).toBeLessThan(
      large
    );
    const cubic = cubicSegmentCount(metres(0, 0), metres(30, 40), metres(70, -40), metres(100, 0));
    expect(cubic).toBeGreaterThan(1);
  });

  it('setBezierChordTolerance changes the default sampling', () => {
    const p0 = metres(0, 0);
    const p1 = metres(200, 0);
    const p2 = metres(200, 200);
    const fine = calculateBezier(p0, p1, p2).length;
    setBezierChordTolerance(1);
    try {
      expect(calculateBezier(p0, p1, p2).length).toBeLessThan(fine);
    } finally {
      setBezierChordTolerance(DEFAULT_CHORD_TOLERANCE_M);
    }
  });
});
