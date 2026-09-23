/**
 * Stitching SIDs, STARs and approaches into an enroute plan. Pure: the
 * procedures arrive already resolved to coordinates from the nav database.
 */
import type { EnrichedFlightPlan, FMSFlightPlan, FMSWaypoint, FMSWaypointType } from '@/types/fms';
import type { ResolvedProcedure, ResolvedProcedureWaypoint } from '@/types/navigation';
import type { ProcedureChoice } from './types';

export interface ProcedureParts {
  sid?: ResolvedProcedure;
  star?: ResolvedProcedure;
  approach?: ResolvedProcedure;
}

function runwayMatches(procedureRunway: string | null, runway: string | undefined): boolean {
  if (!procedureRunway) return true;
  if (!runway) return true;
  const bare = procedureRunway.toUpperCase().replace(/^RW/, '');
  // "RW25B" in CIFP means both 25L and 25R.
  if (bare.endsWith('B')) return runway.startsWith(bare.slice(0, -1));
  return bare === runway.toUpperCase();
}

/** Procedures usable from a runway; with no runway chosen every one is offered. */
export function proceduresForRunway(
  list: ResolvedProcedure[],
  runway: string | undefined
): ResolvedProcedure[] {
  return list.filter((p) => runwayMatches(p.runway, runway));
}

export function choiceKey(choice: ProcedureChoice | undefined): string {
  return choice ? `${choice.name}|${choice.transition ?? ''}` : '';
}

export function matchProcedure(
  list: ResolvedProcedure[],
  choice: ProcedureChoice | undefined,
  runway: string | undefined
): ResolvedProcedure | undefined {
  if (!choice) return undefined;
  const candidates = list.filter(
    (p) => p.name === choice.name && (p.transition ?? null) === choice.transition
  );
  // Prefer the variant published for the chosen runway, then a runway-agnostic one.
  return (
    candidates.find((p) => p.runway && runwayMatches(p.runway, runway)) ??
    candidates.find((p) => !p.runway) ??
    candidates[0]
  );
}

function fmsType(wp: ResolvedProcedureWaypoint): FMSWaypointType {
  if (wp.fixType === 'V' || wp.fixType === 'D') return 3;
  if (wp.fixType === 'N') return 2;
  return 11;
}

/** Constraint altitudes under 1000 are flight levels in CIFP. */
function constraintFeet(wp: ResolvedProcedureWaypoint): number {
  const alt = wp.altitude?.altitude1;
  if (alt === null || alt === undefined) return 0;
  return alt < 1000 ? alt * 100 : alt;
}

function procedureWaypoints(procedure: ResolvedProcedure): FMSWaypoint[] {
  const out: FMSWaypoint[] = [];
  for (const wp of procedure.waypoints) {
    // Runway and airport fixes have no place in the enroute list; unresolved legs cannot be drawn.
    if (wp.fixType === 'C' || wp.fixType === 'A') continue;
    if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
    if (out[out.length - 1]?.id === wp.fixId) continue;
    out.push({
      type: fmsType(wp),
      id: wp.fixId,
      via: procedure.name,
      altitude: constraintFeet(wp),
      latitude: wp.latitude,
      longitude: wp.longitude,
    });
  }
  return out;
}

/** Appends without repeating the fix where two legs meet. */
function join(target: FMSWaypoint[], next: FMSWaypoint[]): void {
  for (const wp of next) {
    const last = target[target.length - 1];
    if (last && last.id === wp.id && last.via !== 'ADEP') {
      // The procedure's own copy carries the constraint and airway name; keep it.
      target[target.length - 1] = { ...wp, altitude: wp.altitude || last.altitude };
      continue;
    }
    target.push(wp);
  }
}

/** Departure, SID, enroute, STAR, approach, arrival, with the header naming each procedure. */
export function composePlan(base: FMSFlightPlan, parts: ProcedureParts): FMSFlightPlan {
  const departure = base.waypoints.find((wp) => wp.via === 'ADEP');
  const arrival = base.waypoints.find((wp) => wp.via === 'ADES');
  const enroute = base.waypoints.filter((wp) => wp.via !== 'ADEP' && wp.via !== 'ADES');

  const waypoints: FMSWaypoint[] = [];
  if (departure) waypoints.push(departure);
  if (parts.sid) join(waypoints, procedureWaypoints(parts.sid));
  join(waypoints, enroute);
  if (parts.star) join(waypoints, procedureWaypoints(parts.star));
  if (parts.approach) join(waypoints, procedureWaypoints(parts.approach));
  if (arrival) waypoints.push(arrival);

  return {
    ...base,
    departure: {
      ...base.departure,
      sid: parts.sid?.name,
      sidTransition: parts.sid?.transition ?? undefined,
    },
    arrival: {
      ...base.arrival,
      star: parts.star?.name,
      starTransition: parts.star?.transition ?? undefined,
      approach: parts.approach?.name,
      approachTransition: parts.approach?.transition ?? undefined,
    },
    waypoints,
  };
}

/** Every waypoint here came from the database, so the enriched copy for the map is all found. */
export function enrichedFromPlan(plan: FMSFlightPlan): EnrichedFlightPlan {
  return {
    ...plan,
    waypoints: plan.waypoints.map((wp) => ({ ...wp, found: true })),
    resolution: {
      total: plan.waypoints.length,
      found: plan.waypoints.length,
      notFound: 0,
      ourCycle: plan.cycle,
      fmsCycle: plan.cycle,
      cycleMatch: true,
    },
  };
}
