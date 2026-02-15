import type { LonLat } from '@/types/geo';

export const DEFAULT_BEZIER_RESOLUTION = 60;

/**
 * Quadratic Bezier interpolation (3 control points)
 * B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
 */
function quadraticBezierPoint(t: number, p0: number, p1: number, p2: number): number {
  const mt = 1 - t;
  return mt * mt * p0 + 2 * mt * t * p1 + t * t * p2;
}

/**
 * Cubic Bezier interpolation (4 control points)
 * B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
function cubicBezierPoint(t: number, p0: number, p1: number, p2: number, p3: number): number {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return mt2 * mt * p0 + 3 * mt2 * t * p1 + 3 * mt * t2 * p2 + t2 * t * p3;
}

/**
 * Calculate points along a quadratic Bezier curve (3 control points)
 * Used for: 112 → 111 or 111 → 112 sequences
 */
export function calculateBezier(
  p0: LonLat,
  p1: LonLat,
  p2: LonLat,
  resolution = DEFAULT_BEZIER_RESOLUTION
): LonLat[] {
  const points: LonLat[] = [];
  for (let i = 0; i <= resolution; i++) {
    const t = i / resolution;
    points.push([
      quadraticBezierPoint(t, p0[0], p1[0], p2[0]),
      quadraticBezierPoint(t, p0[1], p1[1], p2[1]),
    ]);
  }
  return points;
}

/**
 * Calculate points along a cubic Bezier curve (4 control points)
 * Used for: 112 → 112 sequences (consecutive bezier nodes)
 */
export function calculateCubicBezier(
  p0: LonLat,
  p1: LonLat,
  p2: LonLat,
  p3: LonLat,
  resolution = DEFAULT_BEZIER_RESOLUTION
): LonLat[] {
  const points: LonLat[] = [];
  for (let i = 0; i <= resolution; i++) {
    const t = i / resolution;
    points.push([
      cubicBezierPoint(t, p0[0], p1[0], p2[0], p3[0]),
      cubicBezierPoint(t, p0[1], p1[1], p2[1], p3[1]),
    ]);
  }
  return points;
}

/**
 * Mirror a control point around a vertex
 * Used to derive the "incoming" control point from an "outgoing" one
 */
export function mirrorControlPoint(vertex: LonLat, controlPoint: LonLat): LonLat {
  return [2 * vertex[0] - controlPoint[0], 2 * vertex[1] - controlPoint[1]];
}
