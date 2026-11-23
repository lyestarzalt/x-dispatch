import { FEET_PER_METER, METERS_PER_NM } from '@/lib/utils/units/constants';
import type { Coordinates } from '@/types/geo';
import type { Degrees, Feet, Meters, NauticalMiles, Radians } from '@/types/units';
import { EARTH_RADIUS_M, destinationRad, initialBearing, toDegrees, toRadians } from './sphere';

// Re-export arc utilities
export {
  interpolateRFArc,
  createHoldingPattern,
  createProcedureTurn,
  type TurnDirection,
} from './arcs';

// Re-export radius-query bounds
export { boundsAroundPoint, type GeoBounds } from './bounds';

// Re-export course-intersection primitives
export { crossTrackStatus, intersectRadials, lineCircleIntersection } from './intersections';

export type { Degrees, Feet, Meters, NauticalMiles, Radians };
/** `[lat, lon]`, the order `calculateDestination` works in before it is flipped for GeoJSON. */
type LatLon = [number, number];

export function metersToFeet(meters: Meters): Feet {
  return (meters * FEET_PER_METER) as Feet;
}

export function nauticalMilesToMeters(nm: NauticalMiles): Meters {
  return (nm * METERS_PER_NM) as Meters;
}

export function metersToNauticalMiles(meters: Meters): NauticalMiles {
  return (meters / METERS_PER_NM) as NauticalMiles;
}

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): Meters {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return (EARTH_RADIUS_M * c) as Meters;
}

function distanceBetween(p1: Coordinates, p2: Coordinates): Meters {
  return haversineDistance(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
}

export function distanceFeet(lat1: number, lon1: number, lat2: number, lon2: number): Feet {
  return metersToFeet(haversineDistance(lat1, lon1, lat2, lon2));
}

export function distanceNm(lat1: number, lon1: number, lat2: number, lon2: number): NauticalMiles {
  return metersToNauticalMiles(haversineDistance(lat1, lon1, lat2, lon2));
}

export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): Degrees {
  return initialBearing(lat1, lon1, lat2, lon2) as Degrees;
}

function calculateDestination(
  lat: number,
  lon: number,
  distanceMeters: Meters,
  bearingDegrees: Degrees
): LatLon {
  const [φ2, λ2] = destinationRad(
    toRadians(lat),
    toRadians(lon),
    toRadians(bearingDegrees),
    distanceMeters / EARTH_RADIUS_M
  );
  return [toDegrees(φ2), toDegrees(λ2)] as LatLon;
}

export function destinationPoint(
  lat: number,
  lon: number,
  distanceMeters: Meters,
  bearingDegrees: Degrees
): [number, number] {
  const [destLat, destLon] = calculateDestination(lat, lon, distanceMeters, bearingDegrees);
  return [destLon, destLat];
}

export function isValidCoordinate(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat < -90 || lat > 90) return false;
  if (lon < -180 || lon > 180) return false;
  return true;
}

export function runwayLength(end1: Coordinates, end2: Coordinates): Meters {
  return distanceBetween(end1, end2);
}

export function runwayLengthFeet(end1: Coordinates, end2: Coordinates): Feet {
  return metersToFeet(distanceBetween(end1, end2));
}
