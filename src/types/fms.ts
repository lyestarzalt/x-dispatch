/**
 * X-Plane FMS Flight Plan Types
 * Supports FMS v1100 format
 */

export type FMSWaypointType = 1 | 2 | 3 | 11 | 28;

export interface FMSWaypoint {
  type: FMSWaypointType;
  id: string;
  via: string; // ADEP, ADES, DRCT, or airway name
  altitude: number;
  latitude: number;
  longitude: number;
  /** Display only, never written to the file: the published constraint, "6000A", "FL100", "3000A/5000B". */
  constraintLabel?: string;
}

/** One end of a land runway: its threshold, true heading along the runway and the paved length. */
export interface RunwayEnd {
  name: string;
  latitude: number;
  longitude: number;
  headingDeg: number;
  lengthNm: number;
}

export interface FMSFlightPlan {
  version: number;
  cycle?: string;
  departure: {
    icao: string;
    runway?: string;
    sid?: string;
    sidTransition?: string;
  };
  arrival: {
    icao: string;
    runway?: string;
    star?: string;
    starTransition?: string;
    approach?: string;
    approachTransition?: string;
  };
  waypoints: FMSWaypoint[];
}

export interface FMSParseResult {
  success: boolean;
  data: FMSFlightPlan | null;
  error?: string;
}

// Chip types for UI rendering
export type FlightPlanChipType =
  'departure' | 'sid' | 'vor' | 'ndb' | 'fix' | 'latlon' | 'star' | 'arrival';

export interface FlightPlanChip {
  type: FlightPlanChipType;
  id: string;
  via?: string;
  altitude?: number;
  latitude?: number;
  longitude?: number;
  waypointIndex?: number; // Index in waypoints array for navigation
}

// ============================================================================
// Resolved/Enriched Flight Plan Types
// ============================================================================

/**
 * Enriched waypoint with data from our navigation database
 */
export interface EnrichedWaypoint extends FMSWaypoint {
  // Enrichment from DB lookup (undefined if not found)
  name?: string; // "CONSTANTINE VOR"
  frequency?: number; // 114.50 (for VOR/NDB)
  navaidType?: string; // "VOR-DME", "NDB", etc.
  region?: string; // ICAO region code "DA"

  // Flight phase (SimBrief only)
  stage?: 'CLB' | 'CRZ' | 'DSC';

  // Resolution status
  found: boolean; // Was it found in our database?
}

/**
 * Flight plan with enriched waypoints and resolution metadata
 */
export interface EnrichedFlightPlan {
  // Original FMS data
  version: number;
  cycle?: string;
  departure: {
    icao: string;
    runway?: string;
    sid?: string;
    sidTransition?: string;
  };
  arrival: {
    icao: string;
    runway?: string;
    star?: string;
    starTransition?: string;
    approach?: string;
    approachTransition?: string;
  };

  // Enriched waypoints
  waypoints: EnrichedWaypoint[];

  // Alternate airport (SimBrief only)
  alternate?: { icao: string; latitude: number; longitude: number };

  /** Chosen runway ends so the drawn line leaves and joins the actual runway, not the airport datum. */
  runwayEnds?: { departure?: RunwayEnd; arrival?: RunwayEnd };
  /** Published direction of the first turn after take-off, from the SID. */
  firstTurn?: 'L' | 'R';
  /** Straight climb after the runway end before that turn, from the SID's course legs. */
  initialClimbNm?: number;

  // Resolution summary
  resolution: {
    total: number;
    found: number;
    notFound: number;
    ourCycle?: string; // AIRAC cycle from our DB
    fmsCycle?: string; // AIRAC cycle from FMS file
    cycleMatch: boolean;
  };
}
