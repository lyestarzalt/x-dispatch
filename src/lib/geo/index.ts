type Brand<Base, Label extends string> = Base & { readonly __brand: Label };

export type Degrees = Brand<number, 'degrees'>;
export type Meters = Brand<number, 'meters'>;
export type Feet = Brand<number, 'feet'>;
type NauticalMiles = Brand<number, 'nauticalMiles'>;
type LatLon = Brand<[number, number], 'latlon'>;
export type LonLat = Brand<[number, number], 'lonlat'>;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6371000;
const METERS_PER_FOOT = 0.3048;
const FEET_PER_METER = 3.28084;
const METERS_PER_NM = 1852;
const METERS_PER_SM = 1609.34;

// Unit conversions
export function metersToFeet(meters: number): Feet {
  return (meters * FEET_PER_METER) as Feet;
}

function feetToMeters(feet: number): Meters {
  return (feet * METERS_PER_FOOT) as Meters;
}

function metersToNauticalMiles(meters: number): NauticalMiles {
  return (meters / METERS_PER_NM) as NauticalMiles;
}

export function nauticalMilesToMeters(nm: number): Meters {
  return (nm * METERS_PER_NM) as Meters;
}

function metersToStatuteMiles(meters: number): number {
  return meters / METERS_PER_SM;
}

function statuteMilesToMeters(sm: number): Meters {
  return (sm * METERS_PER_SM) as Meters;
}

function kmToNauticalMiles(km: number): NauticalMiles {
  return ((km * 1000) / METERS_PER_NM) as NauticalMiles;
}

function nauticalMilesToKm(nm: number): number {
  return (nm * METERS_PER_NM) / 1000;
}

// Distance calculations (Haversine)
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

// Bearing calculations
export function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): Degrees {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return ((bearing + 360) % 360) as Degrees;
}

function bearingBetween(from: Coordinates, to: Coordinates): Degrees {
  return calculateBearing(from.latitude, from.longitude, to.latitude, to.longitude);
}

// Destination point calculations
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

function calculatePoint(
  lat: number,
  lon: number,
  distanceMeters: number,
  bearingDegrees: number
): LatLon {
  return calculateDestination(lat, lon, distanceMeters, bearingDegrees);
}

// Returns [lon, lat] for GeoJSON/MapLibre
export function destinationPoint(
  lat: number,
  lon: number,
  distanceMeters: number,
  bearingDegrees: number
): LonLat {
  const [destLat, destLon] = calculateDestination(lat, lon, distanceMeters, bearingDegrees);
  return [destLon, destLat] as LonLat;
}

function offsetPoint(
  point: Coordinates,
  distanceMeters: number,
  bearingDegrees: number
): Coordinates {
  const [latitude, longitude] = calculateDestination(
    point.latitude,
    point.longitude,
    distanceMeters,
    bearingDegrees
  );
  return { latitude, longitude };
}

// Runway helpers
export function runwayLength(end1: Coordinates, end2: Coordinates): Meters {
  return distanceBetween(end1, end2);
}

export function runwayLengthFeet(end1: Coordinates, end2: Coordinates): Feet {
  return metersToFeet(distanceBetween(end1, end2));
}

function runwayHeading(end1: Coordinates, end2: Coordinates): Degrees {
  return bearingBetween(end1, end2);
}
