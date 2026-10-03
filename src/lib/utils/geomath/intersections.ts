/**
 * Course-intersection primitives for ARINC 424 leg geometry: CR/VR (course to radial), CI/VI
 * (course to intercept), and CD/VD/FD/FC (course/track to a DME distance) all terminate at the
 * crossing of two courses, or of a course and a DME ring, rather than at a published fix.
 */
import type { Coordinates } from '@/types/geo';
import type { Degrees, NauticalMiles } from './index';

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Intersection of two great-circle courses, each defined by a start point and a bearing.
 * Standard spherical-trigonometry solution (Ed Williams' Aviation Formulary / Movable Type's
 * "intersection of two paths given start points and bearings").
 *
 * Returns null only when the two courses are coincident (same start point, or the same great
 * circle). Any two *distinct* great circles otherwise always cross somewhere, including well
 * behind a start point or most of the way around the globe - this function doesn't know what a
 * "reasonable" leg length is, so for ARINC leg termination the caller must sanity-check the
 * result against the leg's expected distance before trusting it.
 */
export function intersectRadials(
  from1: Coordinates,
  bearing1: Degrees,
  from2: Coordinates,
  bearing2: Degrees
): Coordinates | null {
  const φ1 = toRad(from1.latitude);
  const λ1 = toRad(from1.longitude);
  const φ2 = toRad(from2.latitude);
  const λ2 = toRad(from2.longitude);
  const θ13 = toRad(bearing1);
  const θ23 = toRad(bearing2);

  const Δφ = φ2 - φ1;
  const Δλ = λ2 - λ1;

  const δ12 =
    2 *
    Math.asin(
      Math.sqrt(Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2)
    );
  if (Math.abs(δ12) < 1e-12) return null;

  const clamp = (x: number) => Math.min(1, Math.max(-1, x));
  const cosθa = clamp(
    (Math.sin(φ2) - Math.sin(φ1) * Math.cos(δ12)) / (Math.sin(δ12) * Math.cos(φ1))
  );
  const cosθb = clamp(
    (Math.sin(φ1) - Math.sin(φ2) * Math.cos(δ12)) / (Math.sin(δ12) * Math.cos(φ2))
  );
  const θa = Math.acos(cosθa);
  const θb = Math.acos(cosθb);

  const θ12 = Math.sin(Δλ) > 0 ? θa : 2 * Math.PI - θa;
  const θ21 = Math.sin(Δλ) > 0 ? 2 * Math.PI - θb : θb;

  const α1 = normalizeSigned(θ13 - θ12);
  const α2 = normalizeSigned(θ21 - θ23);
  const sinα1 = Math.sin(α1);
  const sinα2 = Math.sin(α2);

  // sin(α) near zero means the other course's start point sits (almost) exactly on this one -
  // a legitimate case, not a divergence, but one where the general formula below is ill-
  // conditioned (several terms divide by a near-zero sin(α)). Handled directly instead: when
  // from2 lies on course 1, from2 *is* the intersection, and symmetrically for from1 on course 2.
  const EPS = 1e-9;
  if (Math.abs(sinα1) < EPS && Math.abs(sinα2) < EPS) return null; // infinite intersections
  if (Math.abs(sinα1) < EPS) return { latitude: from2.latitude, longitude: from2.longitude };
  if (Math.abs(sinα2) < EPS) return { latitude: from1.latitude, longitude: from1.longitude };
  if (sinα1 * sinα2 < 0) return null; // courses diverge, no forward crossing

  const α3 = Math.acos(
    clamp(-Math.cos(α1) * Math.cos(α2) + Math.sin(α1) * Math.sin(α2) * Math.cos(δ12))
  );
  const δ13 = Math.atan2(
    Math.sin(δ12) * Math.sin(α1) * Math.sin(α2),
    Math.cos(α2) + Math.cos(α1) * Math.cos(α3)
  );
  const φ3 = Math.asin(
    clamp(Math.sin(φ1) * Math.cos(δ13) + Math.cos(φ1) * Math.sin(δ13) * Math.cos(θ13))
  );
  const Δλ13 = Math.atan2(
    Math.sin(θ13) * Math.sin(δ13) * Math.cos(φ1),
    Math.cos(δ13) - Math.sin(φ1) * Math.sin(φ3)
  );
  const λ3 = λ1 + Δλ13;

  return { latitude: toDeg(φ3), longitude: toDeg(λ3) };
}

/** Wraps an angle in radians to (-π, π]. */
function normalizeSigned(rad: number): number {
  const twoPi = 2 * Math.PI;
  const wrapped = ((rad + Math.PI) % twoPi) + twoPi;
  return (wrapped % twoPi) - Math.PI;
}

/** Local tangent-plane offset of `point` from `origin`, in nautical miles (east, north). */
function localOffsetNm(origin: Coordinates, point: Coordinates): [number, number] {
  const originLatRad = toRad(origin.latitude);
  const east = (point.longitude - origin.longitude) * 60 * Math.cos(originLatRad);
  const north = (point.latitude - origin.latitude) * 60;
  return [east, north];
}

/** Inverse of {@link localOffsetNm}: a point `east`/`north` NM from `origin`. */
function fromLocalOffsetNm(origin: Coordinates, east: number, north: number): Coordinates {
  const originLatRad = toRad(origin.latitude);
  return {
    latitude: origin.latitude + north / 60,
    longitude: origin.longitude + east / (60 * Math.cos(originLatRad)),
  };
}

/**
 * First forward crossing of a straight course (from `lineStart`, heading `lineBearing`) into a
 * circle of `radiusNm` around `circleCenter` - the termination of a CD/VD/FD/FC leg. Uses a
 * local tangent-plane approximation, accurate well within charting tolerance at the terminal-area
 * scale these legs are published at (tens of NM).
 *
 * Returns null when the course never reaches the circle, or only crosses it behind the start.
 */
export function lineCircleIntersection(
  lineStart: Coordinates,
  lineBearing: Degrees,
  circleCenter: Coordinates,
  radiusNm: NauticalMiles
): Coordinates | null {
  const [x0, y0] = localOffsetNm(circleCenter, lineStart);
  const θ = toRad(lineBearing);
  const dx = Math.sin(θ);
  const dy = Math.cos(θ);

  const b = 2 * (x0 * dx + y0 * dy);
  const c = x0 * x0 + y0 * y0 - radiusNm * radiusNm;
  const discriminant = b * b - 4 * c;
  if (discriminant < 0) return null;

  const sqrtDisc = Math.sqrt(discriminant);
  const t1 = (-b - sqrtDisc) / 2;
  const t2 = (-b + sqrtDisc) / 2;
  const t = [t1, t2].filter((t) => t >= 0).sort((a, b) => a - b)[0];
  if (t === undefined) return null;

  return fromLocalOffsetNm(circleCenter, x0 + t * dx, y0 + t * dy);
}

/**
 * Along-track and cross-track distance of `point` relative to a course line (from `lineStart`,
 * heading `lineBearing`). Cross-track is positive to the right of the course, negative to the
 * left - used to tell which side of an intercept course a point falls on, and how far along it.
 */
export function crossTrackStatus(
  point: Coordinates,
  lineStart: Coordinates,
  lineBearing: Degrees
): { alongTrackNm: number; crossTrackNm: number } {
  const [x, y] = localOffsetNm(lineStart, point);
  const θ = toRad(lineBearing);
  return {
    alongTrackNm: x * Math.sin(θ) + y * Math.cos(θ),
    crossTrackNm: x * Math.cos(θ) - y * Math.sin(θ),
  };
}
