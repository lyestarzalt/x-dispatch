import type { EnrichedFlightPlan, FMSFlightPlan } from '@/types/fms';

/** One end of the plan: an airport with coordinates, plus the runway once chosen. */
export interface PlanEndpoint {
  icao: string;
  name?: string;
  latitude: number;
  longitude: number;
  runway?: string;
}

/** What the user typed or picked. Persisted so a half-built plan survives a restart. */
export interface PlanDraft {
  departure: PlanEndpoint | null;
  arrival: PlanEndpoint | null;
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

export interface SaveFmsResult {
  success: boolean;
  path?: string;
  error?: string;
}
