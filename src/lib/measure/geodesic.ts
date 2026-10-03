import { type Degrees, calculateBearing } from '@/lib/utils/geomath';

export type LonLatPair = [number, number];

/**
 * Points along the great circle from `from` to `to` (both `[lon, lat]`).
 * Longitudes are unwrapped across the antimeridian so the polyline never
 * jumps 360° between two samples.
 */
export function greatCircleArc(from: LonLatPair, to: LonLatPair, numPoints = 100): LonLatPair[] {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;

  const φ1 = (lat1 * Math.PI) / 180;
  const λ1 = (lon1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ2 = (lon2 * Math.PI) / 180;

  const Δσ = Math.acos(
    Math.min(1, Math.sin(φ1) * Math.sin(φ2) + Math.cos(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1))
  );
  if (Δσ < 0.0001) return [from, to];

  const points: LonLatPair[] = [];
  let prevLon: number | null = null;
  let lonOffset = 0;

  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * Δσ) / Math.sin(Δσ);
    const B = Math.sin(f * Δσ) / Math.sin(Δσ);
    const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
    const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
    const z = A * Math.sin(φ1) + B * Math.sin(φ2);

    const latDeg = (Math.atan2(z, Math.sqrt(x * x + y * y)) * 180) / Math.PI;
    let lonDeg = (Math.atan2(y, x) * 180) / Math.PI;

    if (prevLon !== null) {
      const delta = lonDeg - prevLon;
      if (delta > 180) lonOffset -= 360;
      else if (delta < -180) lonOffset += 360;
    }
    prevLon = lonDeg;
    lonDeg += lonOffset;

    points.push(i === 0 ? from : [lonDeg, latDeg]);
  }
  return points;
}

/** Bearing on arrival at (lat2, lon2) when travelling the great circle from (lat1, lon1). */
export function finalBearing(lat1: number, lon1: number, lat2: number, lon2: number): Degrees {
  const reverse = calculateBearing(lat2, lon2, lat1, lon1);
  return ((((reverse + 180) % 360) + 360) % 360) as Degrees;
}

/** Midpoint along the great circle, `[lon, lat]`. */
export function greatCircleMidpoint(from: LonLatPair, to: LonLatPair): LonLatPair {
  const arc = greatCircleArc(from, to, 2);
  return arc[1] ?? to;
}
