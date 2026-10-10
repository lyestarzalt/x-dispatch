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

/** `warning`: used as typed, but flagged. */
export type RouteTokenStatus = 'ok' | 'unknown' | 'invalid' | 'warning';

/** Machine-readable reasons; the UI translates them. */
export type RouteIssue =
  | 'notFound'
  | 'airwayNoFixBefore'
  | 'airwayNoFixAfter'
  | 'airwayExitUnknown'
  | 'airwayNotJoined'
  | 'airwayEndsAtCoordinate'
  /** A NAT designator filed for part of the track; the message asks for the whole track. */
  | 'trackPartial'
  /** A one-way airway walked against its published direction. */
  | 'airwayWrongWay'
  /** The cruise level is outside the airway's published level band. */
  | 'airwayLevel';

/** Feet; null means no limit on that side. */
export interface LevelBand {
  minFt: number | null;
  maxFt: number | null;
}

export interface RouteToken {
  text: string;
  kind: RouteTokenKind;
  status: RouteTokenStatus;
  issue?: RouteIssue;
  /** The published band of the segment behind an `airwayLevel` warning. */
  levels?: LevelBand;
}

export interface RouteResolution {
  plan: FMSFlightPlan;
  tokens: RouteToken[];
  distanceNm: number;
  /** What every airway walked allows together: the highest floor and the lowest ceiling. */
  levels: LevelBand;
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
  /** A NAT track the route must use, by designator ("NATA"). */
  track?: string;
}

export interface AutoRouteResult {
  /** Route in filing form, ready for the route field: "ARNEM UL620 OSN T180 KEKIX". */
  routeText: string;
  distanceNm: number;
  /** Procedures the router joined through, when it was given candidates. */
  sid?: ProcedureChoice;
  star?: ProcedureChoice;
}

/** A North Atlantic track with every point placed, as the main process hands it over. */
export interface OceanicTrackInfo {
  /** The letter, "A". */
  id: string;
  /** Filed designator, "NATA". */
  name: string;
  eastbound: boolean;
  /** Flight levels available in the track direction. */
  levels: number[];
  validFrom: string;
  validTo: string;
  points: { id: string; latitude: number; longitude: number }[];
  /** North American Routes published for the track, "N944A". */
  nars: string[];
  /** European routing fixes published for the track direction (EUR RTS), none for NIL. */
  feederFixes: string[];
  /** Listed among the PBCS tracks of its message. */
  pbcs: boolean;
}

export type NatMessageStatus = 'current' | 'upcoming';

/** One track message (one direction, one validity window) with its tracks. */
export interface NatMessageInfo {
  /** Issuing centre, "EGGX" (Shanwick, westbound) or "CZQX" (Gander, eastbound). */
  origin: string;
  eastbound: boolean;
  /** Track message identifier from the remarks, "TMI IS 281". */
  tmi: number | null;
  validFrom: string;
  validTo: string;
  status: NatMessageStatus;
  /** The REMARKS block as published. */
  remarks: string;
  tracks: OceanicTrackInfo[];
}

/** What the renderer gets: every unexpired message plus how the last download went. */
export interface NatFeed {
  messages: NatMessageInfo[];
  /** Epoch ms of the last successful download, null before the first. */
  fetchedAt: number | null;
  /** Why the last download failed, null when it succeeded. */
  error: string | null;
}

export interface SaveFmsResult {
  success: boolean;
  path?: string;
  error?: string;
}
