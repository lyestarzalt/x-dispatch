/**
 * The spherical-earth core every geometry module builds on: one copy of each formula, in
 * the exact arithmetic the callers used before they shared it, so a drawn route does not
 * move by a digit. Callers keep their own point shapes and units and convert at the edge.
 */
import type { Degrees, Radians } from '@/types/units';

/** Mean Earth radius in metres. */
export const EARTH_RADIUS_M = 6371000;
/** The same radius in nautical miles, as the flight plan code has always used it. */
export const EARTH_RADIUS_NM = 3440.065;

export function toRadians(degrees: number): Radians {
  return ((degrees * Math.PI) / 180) as Radians;
}

export function toDegrees(radians: number): Degrees {
  return ((radians * 180) / Math.PI) as Degrees;
}

/** Initial true bearing from point 1 to point 2, in degrees, 0 to 360. */
export function initialBearing(lat1: number, lon1: number, lat2: number, lon2: number): Degrees {
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δλ = toRadians(lon2 - lon1);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  return ((toDegrees(Math.atan2(y, x)) + 360) % 360) as Degrees;
}

/**
 * The point reached from (`φ1`, `λ1`) along bearing `θ` after an angular distance `δ`, all
 * in radians. Returns `[φ2, λ2]` in radians; the longitude is not wrapped. Angular distance
 * is the travelled distance divided by the Earth radius in the same unit.
 */
export function destinationRad(φ1: number, λ1: number, θ: number, δ: number): [Radians, Radians] {
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return [φ2 as Radians, λ2 as Radians];
}
