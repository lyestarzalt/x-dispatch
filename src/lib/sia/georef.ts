import * as fs from 'fs';
import * as path from 'path';
import type { VacGeorefCorners } from './types';

export interface AirportGeorefInput {
  lat: number;
  lon: number;
  /** Runway end positions for rotation alignment */
  runways?: Array<{
    lat1: number;
    lon1: number;
    lat2: number;
    lon2: number;
    lengthM: number;
  }>;
}

const DEFAULT_HALF_SIZE_DEG = 0.012;

function offsetLatLon(
  lat: number,
  lon: number,
  dNorthDeg: number,
  dEastDeg: number
): [number, number] {
  const latRad = (lat * Math.PI) / 180;
  const dLat = dNorthDeg;
  const dLon = dEastDeg / Math.cos(latRad || 1e-6);
  return [lon + dLon, lat + dLat];
}

function runwayBearing(runways: AirportGeorefInput['runways']): number | null {
  if (!runways?.length) return null;
  const dist = (r: NonNullable<typeof runways>[number]) => {
    const dLat = r.lat2 - r.lat1;
    const dLon = r.lon2 - r.lon1;
    return dLat * dLat + dLon * dLon;
  };
  const longest = runways.reduce((a, b) => (dist(a) >= dist(b) ? a : b));
  const dLon = longest.lon2 - longest.lon1;
  const dLat = longest.lat2 - longest.lat1;
  return (Math.atan2(dLon, dLat) * 180) / Math.PI;
}

/**
 * Build MapLibre image corners: top-left, top-right, bottom-right, bottom-left.
 */
export function computeGeorefFromAirport(airport: AirportGeorefInput): VacGeorefCorners {
  const bearing = runwayBearing(airport.runways) ?? 0;
  const half = DEFAULT_HALF_SIZE_DEG;
  const rad = (bearing * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners: Array<[number, number]> = [
    [-half * cos - half * sin, half * sin - half * cos],
    [half * cos - half * sin, -half * sin - half * cos],
    [half * cos + half * sin, -half * sin + half * cos],
    [-half * cos + half * sin, half * sin + half * cos],
  ].map(([dN, dE]) => offsetLatLon(airport.lat, airport.lon, dN ?? 0, dE ?? 0));

  return {
    coordinates: corners as VacGeorefCorners['coordinates'],
    source: 'apt',
  };
}

export function loadGeorefSidecar(georefDir: string, icao: string): VacGeorefCorners | null {
  const file = path.join(georefDir, `${icao.toUpperCase()}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as {
      coordinates?: [[number, number], [number, number], [number, number], [number, number]];
    };
    if (raw.coordinates?.length === 4) {
      return { coordinates: raw.coordinates, source: 'sidecar' };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveVacGeoref(
  georefDir: string,
  icao: string,
  airport: AirportGeorefInput | null
): VacGeorefCorners {
  const sidecar = loadGeorefSidecar(georefDir, icao);
  if (sidecar) return sidecar;
  if (airport) return computeGeorefFromAirport(airport);
  const lat = 46.5;
  const lon = 2.5;
  const half = DEFAULT_HALF_SIZE_DEG;
  return {
    coordinates: [
      offsetLatLon(lat, lon, half, -half),
      offsetLatLon(lat, lon, half, half),
      offsetLatLon(lat, lon, -half, half),
      offsetLatLon(lat, lon, -half, -half),
    ] as VacGeorefCorners['coordinates'],
    source: 'default',
  };
}
