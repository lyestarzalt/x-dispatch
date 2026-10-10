import type { LonLat } from '@/types/geo';

/**
 * Largest distance allowed between a sampled chord and the true curve, in
 * metres. MapLibre simplifies tiles at 0.375 px of its top tile zoom, which
 * is 0.15 to 0.22 m on the ground, so nothing under this is visible.
 */
export const DEFAULT_CHORD_TOLERANCE_M = 0.1;

/** Guard against malformed control points producing runaway sampling. */
const MAX_SEGMENTS = 128;

const METRES_PER_DEG_LAT = 111320;

let chordToleranceM = DEFAULT_CHORD_TOLERANCE_M;

/** Override the chord tolerance; tests use it to build a dense reference. */
export function setBezierChordTolerance(metres: number): void {
  chordToleranceM = metres > 0 ? metres : DEFAULT_CHORD_TOLERANCE_M;
}

export function getBezierChordTolerance(): number {
  return chordToleranceM;
}

/** Length in metres of a lon/lat delta, on a flat earth at the given latitude. */
function deltaMetres(dLon: number, dLat: number, lat: number): number {
  const mPerDegLon = METRES_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dLon * mPerDegLon, dLat * METRES_PER_DEG_LAT);
}

function clampSegments(n: number): number {
  if (!Number.isFinite(n)) return MAX_SEGMENTS;
  return Math.min(MAX_SEGMENTS, Math.max(1, Math.ceil(n)));
}

/**
 * Segments needed so every chord of a quadratic bezier stays within
 * `tolerance` metres of the curve. The second derivative of a quadratic
 * is the constant 2(P0 - 2P1 + P2), so the chord error over n segments
 * is at most |P0 - 2P1 + P2| / (4 n²).
 */
export function quadraticSegmentCount(
  p0: LonLat,
  p1: LonLat,
  p2: LonLat,
  tolerance = chordToleranceM
): number {
  const l2 = deltaMetres(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1], p0[1]);
  return clampSegments(Math.sqrt(l2 / (4 * tolerance)));
}

/**
 * Segments needed so every chord of a cubic bezier stays within `tolerance`
 * metres of the curve. The second derivative is bounded by 6 times the
 * larger second difference of the control polygon, giving a chord error of
 * at most 3 L2 / (4 n²).
 */
export function cubicSegmentCount(
  p0: LonLat,
  p1: LonLat,
  p2: LonLat,
  p3: LonLat,
  tolerance = chordToleranceM
): number {
  const a = deltaMetres(p0[0] - 2 * p1[0] + p2[0], p0[1] - 2 * p1[1] + p2[1], p0[1]);
  const b = deltaMetres(p1[0] - 2 * p2[0] + p3[0], p1[1] - 2 * p2[1] + p3[1], p0[1]);
  return clampSegments(Math.sqrt((3 * Math.max(a, b)) / (4 * tolerance)));
}

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
 *
 * The first point is exactly p0 and the last exactly p2, so path joins
 * stay bit-identical regardless of how many chords lie between them.
 */
export function calculateBezier(
  p0: LonLat,
  p1: LonLat,
  p2: LonLat,
  resolution = quadraticSegmentCount(p0, p1, p2)
): LonLat[] {
  const points: LonLat[] = [p0];
  for (let i = 1; i < resolution; i++) {
    const t = i / resolution;
    points.push([
      quadraticBezierPoint(t, p0[0], p1[0], p2[0]),
      quadraticBezierPoint(t, p0[1], p1[1], p2[1]),
    ]);
  }
  points.push(p2);
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
  resolution = cubicSegmentCount(p0, p1, p2, p3)
): LonLat[] {
  const points: LonLat[] = [p0];
  for (let i = 1; i < resolution; i++) {
    const t = i / resolution;
    points.push([
      cubicBezierPoint(t, p0[0], p1[0], p2[0], p3[0]),
      cubicBezierPoint(t, p0[1], p1[1], p2[1], p3[1]),
    ]);
  }
  points.push(p3);
  return points;
}

/**
 * Mirror a control point around a vertex
 * Used to derive the "incoming" control point from an "outgoing" one
 */
export function mirrorControlPoint(vertex: LonLat, controlPoint: LonLat): LonLat {
  return [2 * vertex[0] - controlPoint[0], 2 * vertex[1] - controlPoint[1]];
}
