/**
 * An X-Plane .fms file as a planner draft. The file lists only the enroute fixes and names
 * its procedures; the planner looks those up, walks the airways and draws the result the way
 * it does for a typed route.
 */
import type { FMSFlightPlan, FMSWaypoint } from '@/types/fms';
import type { PlanDraft, PlanEndpoint } from './types';

/** A procedure as the file names it; the transition may be a meeting fix rather than a published one. */
export interface FiledProcedure {
  name: string;
  transition?: string;
}

export interface FiledProcedures {
  sid?: FiledProcedure;
  star?: FiledProcedure;
  approach?: FiledProcedure;
}

export interface FmsDraft extends PlanDraft {
  departure: PlanEndpoint;
  arrival: PlanEndpoint;
  filed: FiledProcedures;
}

const DIRECT = new Set(['DRCT', 'ADEP', 'ADES']);

function enrouteRows(plan: FMSFlightPlan): FMSWaypoint[] {
  return plan.waypoints.filter((wp) => wp.via !== 'ADEP' && wp.via !== 'ADES');
}

function ident(wp: FMSWaypoint): string {
  return wp.type === 28 ? `${wp.latitude}/${wp.longitude}` : wp.id;
}

/**
 * The rows as route text: each airway named once between the fix the route joins it at and
 * the one it leaves at. A first row already on an airway (the planner that wrote the file
 * left the SID's exit out) opens the route on that fix.
 */
export function routeTextFromFms(plan: FMSFlightPlan): string {
  const tokens: string[] = [];
  let airway: string | null = null;
  for (const wp of enrouteRows(plan)) {
    const via = DIRECT.has(wp.via) ? null : wp.via;
    if (via && via === airway) {
      tokens[tokens.length - 1] = ident(wp);
    } else if (via && tokens.length > 0) {
      tokens.push(via, ident(wp));
    } else {
      tokens.push(ident(wp));
      airway = null;
      continue;
    }
    airway = via;
  }
  return tokens.length > 0 ? tokens.join(' ') : 'DCT';
}

function endpoint(
  wp: FMSWaypoint | undefined,
  runway: string | undefined,
  nameOf: (icao: string) => string | undefined
): PlanEndpoint | null {
  if (!wp) return null;
  return {
    icao: wp.id,
    name: nameOf(wp.id),
    latitude: wp.latitude,
    longitude: wp.longitude,
    runway,
  };
}

function filed(
  name: string | undefined,
  transition: string | undefined
): FiledProcedure | undefined {
  return name ? { name, transition } : undefined;
}

/** Null when the file lacks either airport row; the planner cannot start without both. */
export function draftFromFms(
  plan: FMSFlightPlan,
  nameOf: (icao: string) => string | undefined
): FmsDraft | null {
  const departure = endpoint(
    plan.waypoints.find((wp) => wp.via === 'ADEP'),
    plan.departure.runway,
    nameOf
  );
  const arrival = endpoint(
    plan.waypoints.find((wp) => wp.via === 'ADES'),
    plan.arrival.runway,
    nameOf
  );
  if (!departure || !arrival) return null;
  const cruise = Math.max(0, ...enrouteRows(plan).map((wp) => wp.altitude));
  const procedures: FiledProcedures = {};
  const sid = filed(plan.departure.sid, plan.departure.sidTransition);
  const star = filed(plan.arrival.star, plan.arrival.starTransition);
  const approach = filed(plan.arrival.approach, plan.arrival.approachTransition);
  if (sid) procedures.sid = sid;
  if (star) procedures.star = star;
  if (approach) procedures.approach = approach;
  return {
    departure,
    arrival,
    routeText: routeTextFromFms(plan),
    cruiseAltitudeFt: cruise > 0 ? cruise : null,
    filed: procedures,
  };
}
