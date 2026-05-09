import type { LngLatBoundsLike } from 'maplibre-gl';
import type { ParsedAirport } from '@/types/apt';

/**
 * Bounding box [[minLon, minLat], [maxLon, maxLat]] around all runway
 * endpoints of a parsed airport.
 *
 * Returned as `LngLatBoundsLike` so it can be passed straight to
 * `map.fitBounds(...)`. If the airport has no runways (heliport-only,
 * malformed apt.dat, etc.), returns a degenerate point bounds at
 * `fallback`; the caller can then drive the camera with a fixed zoom
 * since fitBounds on a point is undefined-ish.
 */
export function getAirportBounds(
  airport: ParsedAirport,
  fallback: [number, number]
): LngLatBoundsLike {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const rwy of airport.runways) {
    for (const end of rwy.ends) {
      if (end.longitude < minLon) minLon = end.longitude;
      if (end.longitude > maxLon) maxLon = end.longitude;
      if (end.latitude < minLat) minLat = end.latitude;
      if (end.latitude > maxLat) maxLat = end.latitude;
    }
  }

  if (!Number.isFinite(minLon)) {
    return [fallback, fallback];
  }
  return [
    [minLon, minLat],
    [maxLon, maxLat],
  ];
}

/**
 * True when the bounds cover a real area (i.e. at least one runway). Useful
 * for callers deciding between fitBounds and a fixed-zoom flyTo.
 */
export function airportBoundsHaveArea(bounds: LngLatBoundsLike): boolean {
  if (!Array.isArray(bounds) || bounds.length !== 2) return false;
  const [a, b] = bounds as [[number, number], [number, number]];
  return a[0] !== b[0] || a[1] !== b[1];
}
