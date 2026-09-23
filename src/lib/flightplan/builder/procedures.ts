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
function toFeet(alt: number): number {
  return alt < 1000 ? alt * 100 : alt;
}

function constraintFeet(wp: ResolvedProcedureWaypoint): number {
  const alt = wp.altitude?.altitude1;
  return alt === null || alt === undefined ? 0 : toFeet(alt);
}

function altitudeText(alt: number): string {
  return alt < 1000 ? `FL${alt}` : String(alt);
}

/** Chart shorthand: A is at or above, B at or below, a bare number is at. */
export function constraintLabel(wp: ResolvedProcedureWaypoint): string {
  const c = wp.altitude;
  if (!c || c.altitude1 === null) return '';
  const a1 = altitudeText(c.altitude1);
  switch (c.descriptor) {
    case '+':
      return `${a1}A`;
    case '-':
      return `${a1}B`;
    case 'B':
      return c.altitude2 === null ? a1 : `${altitudeText(c.altitude2)}A/${a1}B`;
    default:
      return a1;
  }
}

/** Published direction of the first turn after take-off, if the SID says. */
export function sidFirstTurn(sid: ResolvedProcedure | undefined): 'L' | 'R' | undefined {
  return sid?.waypoints.find((wp) => wp.turnDirection !== null)?.turnDirection ?? undefined;
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
      constraintLabel: constraintLabel(wp),
    });
  }
  return out;
}

/** Last drawable fix of a SID: where the enroute part begins. */
export function procedureExit(procedure: ResolvedProcedure | undefined): FMSWaypoint | undefined {
  if (!procedure) return undefined;
  const wps = procedureWaypoints(procedure);
  return wps[wps.length - 1];
}

/** First drawable fix of a STAR or approach: where the enroute part ends. */
export function procedureEntry(procedure: ResolvedProcedure | undefined): FMSWaypoint | undefined {
  return procedure ? procedureWaypoints(procedure)[0] : undefined;
}

/**
 * Enroute fixes before the SID exit or after the STAR entry would double back
 * over the procedure, so they are dropped when the boundary fix is in the route.
 */
function trimEnroute(
  enroute: FMSWaypoint[],
  exit: FMSWaypoint | undefined,
  entry: FMSWaypoint | undefined
): FMSWaypoint[] {
  let out = enroute;
  if (exit) {
    const i = out.findIndex((wp) => wp.id === exit.id);
    if (i > 0) out = out.slice(i);
  }
  if (entry) {
    const i = out.findIndex((wp) => wp.id === entry.id);
    if (i >= 0 && i < out.length - 1) out = out.slice(0, i + 1);
  }
  return out;
}

/** Appends without repeating the fix where two legs meet. */
function join(target: FMSWaypoint[], next: FMSWaypoint[]): void {
  for (const wp of next) {
    const last = target[target.length - 1];
    if (last && last.id === wp.id && last.via !== 'ADEP') {
      // The procedure's own copy carries the constraint and airway name; keep it.
      target[target.length - 1] = {
        ...wp,
        altitude: wp.altitude || last.altitude,
        constraintLabel: wp.constraintLabel ?? last.constraintLabel,
      };
      continue;
    }
    target.push(wp);
  }
}

/** Departure, SID, enroute, STAR, approach, arrival, with the header naming each procedure. */
export function composePlan(base: FMSFlightPlan, parts: ProcedureParts): FMSFlightPlan {
  const departure = base.waypoints.find((wp) => wp.via === 'ADEP');
  const arrival = base.waypoints.find((wp) => wp.via === 'ADES');
  const enroute = trimEnroute(
    base.waypoints.filter((wp) => wp.via !== 'ADEP' && wp.via !== 'ADES'),
    procedureExit(parts.sid),
    procedureEntry(parts.star ?? parts.approach)
  );

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
export function enrichedFromPlan(
  plan: FMSFlightPlan,
  runwayEnds?: EnrichedFlightPlan['runwayEnds'],
  firstTurn?: EnrichedFlightPlan['firstTurn']
): EnrichedFlightPlan {
  return {
    ...plan,
    runwayEnds,
    firstTurn,
    // Enroute fixes carry the cruise level for the file; the map shows only published constraints.
    waypoints: plan.waypoints.map((wp) => ({
      ...wp,
      constraintLabel: wp.constraintLabel ?? '',
      found: true,
    })),
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
