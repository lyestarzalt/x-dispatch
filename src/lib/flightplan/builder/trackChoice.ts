/**
 * Renderer-side helpers for offering North Atlantic tracks: which track a route already files,
 * and whether a pair of airports crosses the track system at all.
 */
import type { LatLon } from './geometry';
import { NAT_TRACK_RE, tokenizeRoute } from './routeTokens';

/** The track designator filed in the route ("NATA"), or null when the route has none. */
export function trackInRoute(routeText: string): string | null {
  for (const token of tokenizeRoute(routeText)) {
    const upper = token.toUpperCase();
    if (NAT_TRACK_RE.test(upper)) return upper;
  }
  return null;
}

/** The organised track system sits mid-ocean; a crossing has one end either side of this meridian. */
const NAT_MERIDIAN = -30;
/** South of this the crossing runs below the track system (Caribbean and South America). */
const NAT_MIN_LAT = 20;

export type NatDirection = 'eastbound' | 'westbound';

/**
 * Which way the flight crosses the North Atlantic, or null when it does not: both ends on the
 * same side of mid-ocean, or either end too far south for the track system to matter.
 */
export function natCrossing(departure: LatLon, arrival: LatLon): NatDirection | null {
  if (departure.latitude < NAT_MIN_LAT || arrival.latitude < NAT_MIN_LAT) return null;
  const depWest = departure.longitude < NAT_MERIDIAN;
  const arrWest = arrival.longitude < NAT_MERIDIAN;
  if (depWest === arrWest) return null;
  return depWest ? 'eastbound' : 'westbound';
}
