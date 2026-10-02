/**
 * Stitching SIDs, STARs and approaches into an enroute plan. Pure: the
 * procedures arrive already resolved to coordinates from the nav database.
 */
import type { EnrichedFlightPlan, FMSFlightPlan, FMSWaypoint, FMSWaypointType } from '@/types/fms';
import type {
  PathTerminator,
  ResolvedProcedure,
  ResolvedProcedureWaypoint,
} from '@/types/navigation';
import type { ProcedureChoice, RouteJoin } from './types';

export interface ProcedureParts {
  sid?: ResolvedProcedure;
  star?: ResolvedProcedure;
  approach?: ResolvedProcedure;
}

/** Whether a procedure published for `procedureRunway` applies to the chosen runway. */
export function runwayMatches(procedureRunway: string | null, runway: string | undefined): boolean {
  if (!procedureRunway) return true;
  if (!runway) return true;
  const bare = procedureRunway.toUpperCase().replace(/^RW/, '');
  if (bare === 'ALL') return true;
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

function constraintFeet(wp: ResolvedProcedureWaypoint): number {
  return wp.altitude?.altitude1 ?? 0;
}

function altitudeText(alt: number, isFlightLevel: boolean): string {
  return isFlightLevel ? `FL${Math.round(alt / 100)}` : String(alt);
}

/** Chart shorthand: A is at or above, B at or below, a bare number is at. */
export function constraintLabel(wp: ResolvedProcedureWaypoint): string {
  const c = wp.altitude;
  if (!c || c.altitude1 === null) return '';
  const fl = c.isFlightLevel ?? false;
  const a1 = altitudeText(c.altitude1, fl);
  switch (c.descriptor) {
    case '+':
      return `${a1}A`;
    case '-':
      return `${a1}B`;
    case 'B':
      return c.altitude2 === null ? a1 : `${altitudeText(c.altitude2, fl)}A/${a1}B`;
    default:
      return a1;
  }
}

/**
 * Candidate joins for the router: one per distinct fix, procedure and
 * transition, from whichever end of each procedure `pick` returns.
 */
export function procedureJoins(
  list: ResolvedProcedure[],
  pick: (p: ResolvedProcedure) => FMSWaypoint | undefined
): RouteJoin[] {
  const seen = new Map<string, RouteJoin>();
  for (const p of list) {
    const wp = pick(p);
    if (!wp) continue;
    const join: RouteJoin = {
      id: wp.id,
      latitude: wp.latitude,
      longitude: wp.longitude,
      procedure: p.name,
      transition: p.transition ?? null,
    };
    seen.set(`${join.id}|${join.procedure}|${join.transition ?? ''}`, join);
  }
  return [...seen.values()];
}

/**
 * Published direction of the first turn after take-off, if the SID says. Only
 * legs up to the first drawable fix count: a turn published on a later leg
 * belongs to that leg, and forcing it onto the initial turn can wrap the line
 * most of the way around the turn circle.
 */
export function sidFirstTurn(sid: ResolvedProcedure | undefined): 'L' | 'R' | undefined {
  if (!sid) return undefined;
  for (const wp of sid.waypoints) {
    if (wp.turnDirection !== null) return wp.turnDirection;
    if (
      wp.fixType !== 'C' &&
      wp.fixType !== 'A' &&
      FLY_TO_TERMINATORS.has(wp.pathTerminator) &&
      wp.resolved
    ) {
      return undefined;
    }
  }
  return undefined;
}

/**
 * Leg types that end at their fix. A leg of any other type names its fix as a
 * reference (the origin of a course, a DME source) and the aircraft does not
 * fly to it, so drawing it as a point would loop the route back over it.
 */
const FLY_TO_TERMINATORS = new Set<PathTerminator>([
  'IF',
  'TF',
  'CF',
  'DF',
  'RF',
  'AF',
  'HA',
  'HF',
  'HM',
  'PI',
]);

/** Planning climb gradient for turning course-to-altitude legs into a distance. */
const CLIMB_FT_PER_NM = 300;
const MIN_CLIMB_NM = 2;
const MAX_CLIMB_NM = 20;
/** Length assumed for an intercept or radial termination leg. */
const INTERCEPT_NM = 3;

/**
 * Straight climb after the runway end before the first turn, from the SID's
 * course legs ahead of its first fly-to fix. A DME distance is measured from a
 * navaid taken to be on the field, so half the runway is subtracted.
 */
export function sidInitialClimbNm(
  sid: ResolvedProcedure | undefined,
  runwayLengthNm = 1.5
): number | undefined {
  if (!sid) return undefined;
  let total = 0;
  let found = false;
  for (const wp of sid.waypoints) {
    if (wp.fixType === 'C' || wp.fixType === 'A') continue;
    if (FLY_TO_TERMINATORS.has(wp.pathTerminator)) break;
    switch (wp.pathTerminator) {
      case 'CA':
      case 'VA':
      case 'FA': {
        const alt = wp.altitude?.altitude1;
        if (alt !== null && alt !== undefined) {
          total += alt / CLIMB_FT_PER_NM;
          found = true;
        }
        break;
      }
      case 'CD':
      case 'VD':
      case 'FD':
      case 'FC':
        if (wp.distance !== null) {
          total += Math.max(0, wp.distance - runwayLengthNm / 2);
          found = true;
        }
        break;
      case 'CI':
      case 'VI':
      case 'CR':
      case 'VR':
        total += INTERCEPT_NM;
        found = true;
        break;
      default:
        break;
    }
  }
  if (!found) return undefined;
  return Math.min(MAX_CLIMB_NM, Math.max(MIN_CLIMB_NM, total));
}

function procedureWaypoints(procedure: ResolvedProcedure): FMSWaypoint[] {
  const out: FMSWaypoint[] = [];
  for (const wp of procedure.waypoints) {
    // Runway and airport fixes have no place in the enroute list; unresolved legs cannot be drawn.
    if (wp.fixType === 'C' || wp.fixType === 'A') continue;
    if (!FLY_TO_TERMINATORS.has(wp.pathTerminator)) continue;
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

/** A single runway named by a procedure, "RW25L"; never the "RW25B" both-sides form. */
function procedureRunway(...procedures: (ResolvedProcedure | undefined)[]): string | undefined {
  for (const p of procedures) {
    const rwy = p?.runway?.toUpperCase();
    if (rwy && /^(RW)?\d{2}[LCR]?$/.test(rwy)) return rwy.replace(/^RW/, '');
  }
  return undefined;
}

function header(base: FMSFlightPlan, parts: ProcedureParts) {
  return {
    departure: {
      ...base.departure,
      runway: base.departure.runway ?? procedureRunway(parts.sid),
      sid: parts.sid?.name,
      sidTransition: parts.sid?.transition ?? undefined,
    },
    arrival: {
      ...base.arrival,
      // X-Plane needs DESRWY whenever a STAR or approach is named.
      runway: base.arrival.runway ?? procedureRunway(parts.approach, parts.star),
      star: parts.star?.name,
      starTransition: parts.star?.transition ?? undefined,
      approach: parts.approach?.name,
      approachTransition: parts.approach?.transition ?? undefined,
    },
  };
}

function splitBase(base: FMSFlightPlan, parts: ProcedureParts) {
  return {
    departure: base.waypoints.find((wp) => wp.via === 'ADEP'),
    arrival: base.waypoints.find((wp) => wp.via === 'ADES'),
    enroute: trimEnroute(
      base.waypoints.filter((wp) => wp.via !== 'ADEP' && wp.via !== 'ADES'),
      procedureExit(parts.sid),
      procedureEntry(parts.star ?? parts.approach)
    ),
  };
}

/** Departure, SID, enroute, STAR, approach, arrival: the full path the map draws. */
export function composePlan(base: FMSFlightPlan, parts: ProcedureParts): FMSFlightPlan {
  const { departure, arrival, enroute } = splitBase(base, parts);
  const waypoints: FMSWaypoint[] = [];
  if (departure) waypoints.push(departure);
  if (parts.sid) join(waypoints, procedureWaypoints(parts.sid));
  join(waypoints, enroute);
  if (parts.star) join(waypoints, procedureWaypoints(parts.star));
  if (parts.approach) join(waypoints, procedureWaypoints(parts.approach));
  if (arrival) waypoints.push(arrival);
  return { ...base, ...header(base, parts), waypoints };
}

/**
 * What goes in the .fms file. X-Plane loads the named procedures itself, so the
 * enroute block holds only the airports and the fixes between the procedures.
 */
export function planForFile(base: FMSFlightPlan, parts: ProcedureParts): FMSFlightPlan {
  const { departure, arrival, enroute } = splitBase(base, parts);
  // The SID exit and STAR entry belong to the procedures X-Plane loads itself, so they
  // are left out of the enroute block rather than listed twice.
  const exit = procedureExit(parts.sid);
  const entry = procedureEntry(parts.star ?? parts.approach);
  const middle = enroute.filter(
    (wp, i) =>
      !(i === 0 && exit && wp.id === exit.id) &&
      !(i === enroute.length - 1 && entry && wp.id === entry.id)
  );
  const waypoints: FMSWaypoint[] = [];
  if (departure) waypoints.push(departure);
  waypoints.push(...middle);
  if (arrival) waypoints.push(arrival);
  return { ...base, ...header(base, parts), waypoints };
}

export interface DrawingHints {
  runwayEnds?: EnrichedFlightPlan['runwayEnds'];
  firstTurn?: EnrichedFlightPlan['firstTurn'];
  initialClimbNm?: EnrichedFlightPlan['initialClimbNm'];
  procedurePaths?: EnrichedFlightPlan['procedurePaths'];
  alternate?: EnrichedFlightPlan['alternate'];
}

/** Every waypoint here came from the database, so the enriched copy for the map is all found. */
export function enrichedFromPlan(
  plan: FMSFlightPlan,
  hints: DrawingHints = {}
): EnrichedFlightPlan {
  return {
    ...plan,
    ...hints,
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

/** The runway an approach is published for, read from its CIFP ident ("I36C" -> "36C"). */
export function approachRunway(name: string): string | undefined {
  return /^[A-Z](\d{2}[LCR]?)/.exec(name.toUpperCase())?.[1];
}

/** Preference between approach types for the same runway: precision first. */
const APPROACH_TYPE_ORDER = ['I', 'L', 'R', 'D', 'V', 'N'];
function approachPriority(name: string): number {
  const index = APPROACH_TYPE_ORDER.indexOf(name.charAt(0).toUpperCase());
  return index === -1 ? APPROACH_TYPE_ORDER.length : index;
}

export interface ProcedureSuggestionInput {
  sids: ResolvedProcedure[];
  stars: ResolvedProcedure[];
  approaches: ResolvedProcedure[];
  departureRunway?: string;
  arrivalRunway?: string;
  /** First and last enroute fixes of the resolved route (airports excluded). */
  firstEnrouteFixId?: string;
  lastEnrouteFixId?: string;
  /** An already chosen STAR; its exit decides the approach transition. */
  star?: ResolvedProcedure;
}

export interface ProcedureSuggestions {
  sid?: ProcedureChoice;
  star?: ProcedureChoice;
  approach?: ProcedureChoice;
}

const toChoice = (p: ResolvedProcedure): ProcedureChoice => ({
  name: p.name,
  transition: p.transition ?? null,
});

/** Base variants (no transition) first, then by name, so a plain SID beats a same-exit transition. */
const byBaseThenName = (a: ResolvedProcedure, b: ResolvedProcedure): number =>
  Number(a.transition !== null) - Number(b.transition !== null) || a.name.localeCompare(b.name);

/**
 * What a dispatcher would pick given the runways and the route: the SID (and transition) for
 * the departure runway that exits where the route starts, the STAR that enters where the route
 * ends, and the best published approach for the arrival runway, taking the transition the STAR
 * hands over to. Anything without a clean match is left undefined rather than guessed.
 */
export function suggestProcedures(input: ProcedureSuggestionInput): ProcedureSuggestions {
  const out: ProcedureSuggestions = {};

  if (input.departureRunway && input.firstEnrouteFixId) {
    const sid = proceduresForRunway(input.sids, input.departureRunway)
      .filter((p) => procedureExit(p)?.id === input.firstEnrouteFixId)
      .sort(byBaseThenName)[0];
    if (sid) out.sid = toChoice(sid);
  }

  let star = input.star;
  if (input.arrivalRunway && input.lastEnrouteFixId && !star) {
    star = proceduresForRunway(input.stars, input.arrivalRunway)
      .filter((p) => procedureEntry(p)?.id === input.lastEnrouteFixId)
      .sort(byBaseThenName)[0];
    if (star) out.star = toChoice(star);
  }

  if (input.arrivalRunway) {
    const runway = input.arrivalRunway.toUpperCase();
    const forRunway = input.approaches.filter((a) => approachRunway(a.name) === runway);
    const bestName = [...new Set(forRunway.map((a) => a.name))].sort(
      (a, b) => approachPriority(a) - approachPriority(b) || a.localeCompare(b)
    )[0];
    if (bestName) {
      const variants = forRunway.filter((a) => a.name === bestName);
      const handover = procedureExit(star)?.id ?? input.lastEnrouteFixId;
      const approach =
        (handover && variants.find((a) => a.transition && procedureEntry(a)?.id === handover)) ||
        variants.find((a) => !a.transition) ||
        variants[0];
      if (approach) out.approach = toChoice(approach);
    }
  }

  return out;
}
