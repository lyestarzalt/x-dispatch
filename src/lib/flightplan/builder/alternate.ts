/**
 * A sensible alternate for the destination: a land airport a short diversion
 * away, paved for anything faster than a piston. The airport list carries no
 * runway lengths, so runway count stands in for size.
 */
import type { Airport } from '@/lib/xplaneServices/dataService';
import type { RangeRingCategory } from '@/types/layers';
import { type LatLon, greatCircleNm } from './geometry';

const MIN_NM = 20;
const MAX_NM = 150;
/** A single-runway field costs this many miles against a multi-runway one for jets. */
const SINGLE_RUNWAY_PENALTY_NM = 30;

export function suggestAlternate(
  airports: Airport[],
  arrival: LatLon & { icao: string },
  departureIcao: string | null,
  category: RangeRingCategory
): Airport | null {
  let best: Airport | null = null;
  let bestScore = Infinity;
  for (const a of airports) {
    if (a.type !== 'land' || a.icao === arrival.icao || a.icao === departureIcao) continue;
    if (category !== 'prop' && a.surfaceType !== 'paved') continue;
    if (a.runwayCount < 1) continue;
    const nm = greatCircleNm(arrival, { latitude: a.lat, longitude: a.lon });
    if (nm < MIN_NM || nm > MAX_NM) continue;
    const score = nm + (category === 'jet' && a.runwayCount < 2 ? SINGLE_RUNWAY_PENALTY_NM : 0);
    if (score < bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}
