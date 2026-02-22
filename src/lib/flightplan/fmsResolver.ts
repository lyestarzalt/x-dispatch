/**
 * FMS Flight Plan Resolver
 * Enriches FMS waypoints with data from our navigation database.
 */
import {
  getNavaidEnrichedById,
  getWaypointNearestById,
} from '@/lib/xplaneServices/dataService/navdata/navCache';
import type { EnrichedFlightPlan, EnrichedWaypoint, FMSFlightPlan } from '@/types/fms';

// Maximum distance in nm to search for matching waypoint
const MAX_SEARCH_DISTANCE_NM = 100;

/**
 * Format frequency for display
 * VORs stored in Hz * 100, display as MHz (e.g., 11450 -> 114.50)
 * NDBs stored in Hz * 100, display as kHz (e.g., 35000 -> 350)
 */
function formatFrequency(freqRaw: number, isNDB: boolean): number {
  if (freqRaw === 0) return 0;
  if (isNDB) {
    // NDB frequencies are in kHz, stored as Hz * 100
    return Math.round(freqRaw / 100);
  }
  // VOR frequencies are in MHz, stored as Hz * 100
  return freqRaw / 100;
}

/**
 * Resolve and enrich a single waypoint from the FMS file
 */
function resolveWaypoint(
  id: string,
  fmsType: number,
  fmsLat: number,
  fmsLon: number
): Omit<EnrichedWaypoint, 'type' | 'id' | 'via' | 'altitude' | 'latitude' | 'longitude'> {
  // Type 28 = lat/lon waypoint, no resolution needed
  if (fmsType === 28) {
    return { found: true };
  }

  // Type 1 = airport - skip for now (airports are always identifiable by ICAO)
  if (fmsType === 1) {
    return { found: true };
  }

  // Type 2 = NDB, Type 3 = VOR - look in navaids with full enrichment
  if (fmsType === 2 || fmsType === 3) {
    const navaid = getNavaidEnrichedById(id, fmsLat, fmsLon, MAX_SEARCH_DISTANCE_NM);
    if (navaid) {
      const isNDB = fmsType === 2;
      return {
        found: true,
        name: navaid.name,
        navaidType: navaid.type,
        frequency: formatFrequency(navaid.frequency, isNDB),
        region: navaid.region,
      };
    }
    return { found: false };
  }

  // Type 11 = fix/waypoint
  if (fmsType === 11) {
    const waypoint = getWaypointNearestById(id, fmsLat, fmsLon, MAX_SEARCH_DISTANCE_NM);
    if (waypoint) {
      return {
        found: true,
        region: waypoint.region,
      };
    }
    return { found: false };
  }

  // Unknown type
  return { found: false };
}

/**
 * Enrich an FMS flight plan with data from our navigation database
 */
export function enrichFlightPlan(fms: FMSFlightPlan, ourCycle?: string): EnrichedFlightPlan {
  let foundCount = 0;
  let notFoundCount = 0;

  const enrichedWaypoints: EnrichedWaypoint[] = fms.waypoints.map((wp) => {
    const enrichment = resolveWaypoint(wp.id, wp.type, wp.latitude, wp.longitude);

    if (enrichment.found) {
      foundCount++;
    } else {
      notFoundCount++;
    }

    return {
      ...wp,
      ...enrichment,
    };
  });

  const cycleMatch = !fms.cycle || !ourCycle || fms.cycle === ourCycle;

  return {
    version: fms.version,
    cycle: fms.cycle,
    departure: fms.departure,
    arrival: fms.arrival,
    waypoints: enrichedWaypoints,
    resolution: {
      total: fms.waypoints.length,
      found: foundCount,
      notFound: notFoundCount,
      ourCycle,
      fmsCycle: fms.cycle,
      cycleMatch,
    },
  };
}
