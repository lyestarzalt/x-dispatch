import type { EnrichedFlightPlan, EnrichedWaypoint, FMSFlightPlan } from '@/types/fms';

/** Station facts the nav database can add to a waypoint without changing where it is. */
const STATION_FIELDS = ['name', 'navaidType', 'frequency', 'region'] as const;

/** The bare plan the enrichment lookup takes, stripped of fields it must not see. */
export function toFmsPlan(plan: EnrichedFlightPlan): FMSFlightPlan {
  return {
    version: plan.version,
    cycle: plan.cycle,
    departure: plan.departure,
    arrival: plan.arrival,
    waypoints: plan.waypoints.map(({ type, id, via, altitude, latitude, longitude }) => ({
      type,
      id,
      via,
      altitude,
      latitude,
      longitude,
    })),
  };
}

/**
 * Copies station data (name, type, frequency, region) from a database lookup onto a plan
 * whose positions come from another source, such as a SimBrief navlog built on its own
 * AIRAC cycle. Positions, altitudes, stages and the `found` flag are never touched, and a
 * value the plan already had is kept when the lookup has none.
 */
export function mergeStationData(
  plan: EnrichedFlightPlan,
  lookup: EnrichedFlightPlan | null
): EnrichedFlightPlan {
  if (!lookup || lookup.waypoints.length !== plan.waypoints.length) return plan;
  let changed = false;
  const waypoints = plan.waypoints.map((wp, i) => {
    const station = lookup.waypoints[i];
    if (!station || station.id !== wp.id) return wp;
    const next: EnrichedWaypoint = { ...wp };
    for (const field of STATION_FIELDS) {
      const value = station[field];
      if (value !== undefined && value !== '' && value !== 0 && next[field] === undefined) {
        (next as Record<typeof field, unknown>)[field] = value;
        changed = true;
      }
    }
    return next;
  });
  return changed ? { ...plan, waypoints } : plan;
}
