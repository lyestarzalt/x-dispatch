/**
 * Which ATC facilities matter for an airport.
 *
 * A controller is relevant to an airport, not to a country, so the tiers are:
 *  1. the facility names the airport — its ICAO link list or its facility id;
 *  2. the facility's sector polygon contains the airport (centres, TRACONs) —
 *     border-correct for free: Basel gets the French and Swiss sectors that a
 *     country filter would hide;
 *  3. polygon-less facilities from the same ICAO region, a country-level
 *     proxy used only when the data gives nothing better.
 */
import { isPointInPolygon } from '@/lib/utils/geomath/polygon';
import type { ATCController, ATCRole } from '@/types/navigation';

/** Ground-up order of the chain a pilot works: tower, approach, centre. */
const ROLE_ORDER: Record<ATCRole, number> = {
  del: 0,
  gnd: 1,
  twr: 2,
  app: 3,
  tracon: 3,
  ctr: 4,
};

/**
 * The ICAO region prefix: most countries use two letters (EH = Netherlands),
 * a few big ones use one (K = USA, C = Canada, Y = Australia). Comparing two
 * letters there would turn "KD..." vs "KZ..." into different regions.
 */
const SINGLE_LETTER_REGIONS = new Set(['K', 'C', 'Y']);

function sameIcaoRegion(a: string, b: string): boolean {
  const first = a.charAt(0).toUpperCase();
  if (first !== b.charAt(0).toUpperCase()) return false;
  if (SINGLE_LETTER_REGIONS.has(first)) return true;
  return a.charAt(1).toUpperCase() === b.charAt(1).toUpperCase();
}

const MAX_RESULTS = 12;

/**
 * The facilities relevant to an airport, deduped and ordered tower → approach
 * → centre. `lat`/`lon` is the airport reference point for sector containment.
 */
export function selectAtcForAirport(
  controllers: readonly ATCController[],
  icao: string,
  lat: number,
  lon: number
): ATCController[] {
  const airport = icao.trim().toUpperCase();
  const point: [number, number] = [lon, lat];

  const picked: ATCController[] = [];
  const seen = new Set<string>();
  const add = (c: ATCController) => {
    const key = `${c.facilityId}/${c.role}/${c.name}`;
    if (seen.has(key)) return;
    seen.add(key);
    picked.push(c);
  };

  for (const c of controllers) {
    const namesAirport =
      c.facilityId.toUpperCase() === airport ||
      (c.icaos ?? []).some((i) => i.toUpperCase() === airport);
    if (namesAirport) {
      add(c);
      continue;
    }

    if (c.airspaces.length > 0) {
      // Any shelf over the airport counts — a TRACON's surface shelf may be
      // the only one that covers the field.
      if (c.airspaces.some((a) => isPointInPolygon(point, a.polygon))) add(c);
      continue;
    }

    // Polygon-less and not naming the airport: region fallback, centres only —
    // a tower two states away from the same region is never relevant.
    if (c.role === 'ctr' && sameIcaoRegion(c.facilityId, airport)) add(c);
  }

  return picked
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
}
