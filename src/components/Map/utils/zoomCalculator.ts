import { Runway } from '@/lib/aptParser/types';

const EARTH_RADIUS_METERS = 6371e3;

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in meters
 */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Calculate runway length from its end coordinates
 */
export function calculateRunwayLength(runway: Runway): number {
  const end1 = runway.ends[0];
  const end2 = runway.ends[1];

  return haversineDistance(end1.latitude, end1.longitude, end2.latitude, end2.longitude);
}

/**
 * Get the longest runway length from an airport
 */
export function getLongestRunwayLength(runways: Runway[]): number {
  if (runways.length === 0) return 0;

  return Math.max(...runways.map(calculateRunwayLength));
}

/**
 * Calculate optimal zoom level based on airport size
 * Uses longest runway length as the primary metric
 */
export function calculateOptimalZoom(runways: Runway[]): number {
  const longestRunway = getLongestRunwayLength(runways);

  // Zoom levels based on runway length (in meters)
  // Smaller airports need higher zoom, larger airports need lower zoom
  if (longestRunway > 4000) return 13; // Large international (KJFK, EGLL, etc.)
  if (longestRunway > 3000) return 14; // Major airports
  if (longestRunway > 2000) return 15; // Regional airports
  if (longestRunway > 1000) return 16; // Small airports
  if (longestRunway > 500) return 17; // GA airports
  if (longestRunway > 0) return 18; // Very small airfields
  return 14; // Default for airports with no runway data
}

/**
 * Calculate airport center point from runway data
 * Falls back to metadata if available
 */
export function calculateAirportCenter(
  runways: Runway[],
  metadata: Record<string, string>
): [number, number] {
  // Try to use runway midpoints to calculate center
  if (runways.length > 0) {
    let totalLat = 0;
    let totalLon = 0;
    let count = 0;

    for (const runway of runways) {
      for (const end of runway.ends) {
        totalLat += end.latitude;
        totalLon += end.longitude;
        count++;
      }
    }

    if (count > 0) {
      return [totalLon / count, totalLat / count];
    }
  }

  // Fall back to metadata
  if (metadata.datum_lat && metadata.datum_lon) {
    return [parseFloat(metadata.datum_lon), parseFloat(metadata.datum_lat)];
  }

  // Ultimate fallback
  return [0, 0];
}

/**
 * Calculate bounding box for an airport
 */
export function calculateAirportBounds(
  runways: Runway[],
  padding = 0.002 // ~200m padding
): [[number, number], [number, number]] | null {
  if (runways.length === 0) return null;

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;

  for (const runway of runways) {
    for (const end of runway.ends) {
      minLat = Math.min(minLat, end.latitude);
      maxLat = Math.max(maxLat, end.latitude);
      minLon = Math.min(minLon, end.longitude);
      maxLon = Math.max(maxLon, end.longitude);
    }
  }

  return [
    [minLon - padding, minLat - padding], // Southwest
    [maxLon + padding, maxLat + padding], // Northeast
  ];
}
