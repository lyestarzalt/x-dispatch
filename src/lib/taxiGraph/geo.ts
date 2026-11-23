import { METERS_PER_DEG_LAT } from '@/lib/utils/units/constants';
import type { Degrees, Meters } from '@/types/units';

/** Haversine distance between two lat/lon points in metres */
export function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): Meters {
  const R = 6_371_000;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))) as Meters;
}

interface LatLon {
  lat: number;
  lon: number;
}

/** True bearing from `a` to `b` in [0, 360). Flat-earth, fine across an airport. */
export function bearingDeg(a: LatLon, b: LatLon): Degrees {
  const x = (b.lon - a.lon) * Math.cos((a.lat * Math.PI) / 180);
  const y = b.lat - a.lat;
  return (((Math.atan2(x, y) * 180) / Math.PI + 360) % 360) as Degrees;
}

/** Absolute heading change from `inDeg` to `outDeg`, in [0, 180]. */
export function turnDeg(inDeg: number, outDeg: number): Degrees {
  const d = Math.abs(outDeg - inDeg) % 360;
  return (d > 180 ? 360 - d : d) as Degrees;
}

/** Local flat metres around `origin`, for projecting points onto segments. */
export function toLocalMetres(origin: LatLon, p: LatLon): { x: number; y: number } {
  return {
    x: (p.lon - origin.lon) * METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180),
    y: (p.lat - origin.lat) * METERS_PER_DEG_LAT,
  };
}
