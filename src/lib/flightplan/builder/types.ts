import type { EnrichedFlightPlan, FMSFlightPlan, RunwayEnd } from '@/types/fms';

/** A published procedure picked by name plus its enroute transition, if any. */
export interface ProcedureChoice {
  name: string;
  transition: string | null;
}

/** One end of the plan: an airport with coordinates, plus runway and procedures once chosen. */
export interface PlanEndpoint {
  icao: string;
  name?: string;
  latitude: number;
  longitude: number;
  runway?: string;
  /** Geometry of the chosen runway when apt.dat had it; procedure-only runways have none. */
  runwayEnd?: RunwayEnd;
  /** Departure only. */
  sid?: ProcedureChoice;
  /** Arrival only. */
  star?: ProcedureChoice;
  approach?: ProcedureChoice;
}

/** What the user typed or picked. Persisted so a half-built plan survives a restart. */
export interface PlanDraft {
  departure: PlanEndpoint | null;
  arrival: PlanEndpoint | null;
  /** Suggested from the arrival, drawn as a dashed leg; the FMS format has no field for it. */
  alternate?: PlanEndpoint | null;
  /** Free text route, airways and fixes, as filed: "SUGOL UL620 KEKIX T180 OSN". */
  routeText: string;
  cruiseAltitudeFt: number | null;
}

export type RouteTokenKind = 'fix' | 'navaid' | 'airport' | 'airway' | 'latlon' | 'direct';

export type RouteTokenStatus = 'ok' | 'unknown' | 'invalid';

/** Machine-readable reasons; the UI translates them. */
export type RouteIssue =
  | 'notFound'
  | 'airwayNoFixBefore'
  | 'airwayNoFixAfter'
  | 'airwayExitUnknown'
  | 'airwayNotJoined'
  | 'airwayEndsAtCoordinate';

export interface RouteToken {
  text: string;
  kind: RouteTokenKind;
  status: RouteTokenStatus;
  issue?: RouteIssue;
}

export interface RouteResolution {
  plan: FMSFlightPlan;
  tokens: RouteToken[];
  distanceNm: number;
}

/** What the main process hands back: the raw plan plus the enriched copy the map layer draws. */
export interface RouteResolveResult extends RouteResolution {
  enriched: EnrichedFlightPlan;
}

/** A published fix where a SID leaves or a STAR joins the airway network. */
export interface RouteJoin {
  id: string;
  latitude: number;
  longitude: number;
  procedure: string;
  transition: string | null;
}

/**
 * The draft plus where the enroute part really starts and ends: the SID exit
 * and the STAR or approach entry once procedures are chosen, else the airports.
 * When no procedure is chosen the candidate joins let the router pick one.
 */
export interface AutoRouteRequest extends PlanDraft {
  routeFrom?: { latitude: number; longitude: number };
  routeTo?: { latitude: number; longitude: number };
  exits?: RouteJoin[];
  entries?: RouteJoin[];
}

export interface AutoRouteResult {
  /** Route in filing form, ready for the route field: "ARNEM UL620 OSN T180 KEKIX". */
  routeText: string;
  distanceNm: number;
  /** Procedures the router joined through, when it was given candidates. */
  sid?: ProcedureChoice;
  star?: ProcedureChoice;
}

export interface SaveFmsResult {
  success: boolean;
  path?: string;
  error?: string;
}
