import type { Coordinates } from '@/types/geo';

type Brand<Base, Label extends string> = Base & { readonly __brand: Label };

export type Degrees = Brand<number, 'degrees'>;
export type Meters = Brand<number, 'meters'>;
export type Feet = Brand<number, 'feet'>;
type NauticalMiles = Brand<number, 'nauticalMiles'>;
type LatLon = Brand<[number, number], 'latlon'>;
// Internal branded LonLat for geo calculations - external code uses @/types/geo LonLat
type BrandedLonLat = Brand<[number, number], 'lonlat'>;

const EARTH_RADIUS_M = 6371000;
const METERS_PER_FOOT = 0.3048;
const FEET_PER_METER = 3.28084;
const METERS_PER_NM = 1852;

export function metersToFeet(meters: number): Feet {
  return (meters * FEET_PER_METER) as Feet;
}

export function nauticalMilesToMeters(nm: number): Meters {
  return (nm * METERS_PER_NM) as Meters;
}

function metersToNauticalMiles(meters: number): NauticalMiles {
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
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return ((bearing + 360) % 360) as Degrees;
}

function calculateDestination(
  lat: number,
  lon: number,
  distanceMeters: number,
  bearingDegrees: number
): LatLon {
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const θ = (bearingDegrees * Math.PI) / 180;
  const δ = distanceMeters / EARTH_RADIUS_M;

  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));

  return [(φ2 * 180) / Math.PI, (λ2 * 180) / Math.PI] as LatLon;
}

export function destinationPoint(
  lat: number,
  lon: number,
  distanceMeters: number,
  bearingDegrees: number
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
