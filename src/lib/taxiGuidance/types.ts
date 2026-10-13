/**
 * A planned taxi route, self-contained so a window without the airport data
 * (the detached flight strip) can still follow the aircraft along it.
 */
export interface GuidancePoint {
  lat: number;
  lon: number;
}

export type GuidanceDirection = 'departure' | 'arrival';

/** Who made the route: suggested by X-Dispatch on its own, or planned or edited by the pilot. */
export type GuidanceSource = 'auto' | 'planned';

/** One taxi network edge of the route, from `points[i]` to `points[i + 1]`. */
export interface GuidanceLeg {
  /** Taxiway or runway name, empty when the scenery left it blank. */
  name: string;
  isRunway: boolean;
  /**
   * Runways whose protected area this leg is inside, one key per runway as
   * its two ends sorted and joined (`14L/32R`). From apt.dat row 1204
   * departure/arrival zones, and from the edge itself when it is a runway.
   */
  runways: string[];
}

export interface GuidanceRoute {
  icao: string;
  direction: GuidanceDirection;
  /** Departure runway end, or the landing runway end on arrival. */
  runway: string | null;
  /** Gate or stand the route starts from (departure) or ends at (arrival). */
  gateName: string | null;
  source: GuidanceSource;
  points: GuidancePoint[];
  legs: GuidanceLeg[];
  /** Editor state, so the planner can reopen the route: the picked nodes and the full path. */
  anchorNodeIds: number[];
  nodeIds: number[];
}

export type TurnKind =
  'continue' | 'bearLeft' | 'bearRight' | 'turnLeft' | 'turnRight' | 'sharpLeft' | 'sharpRight';

/** Something the pilot has to do at `at` metres along the route. */
export type GuidanceEvent =
  | { kind: 'turn'; turn: TurnKind; name: string; at: number }
  | { kind: 'cross'; runway: string; at: number; pointIndex: number }
  | { kind: 'holdShort'; runway: string; at: number; pointIndex: number | null }
  | { kind: 'arrive'; name: string | null; at: number };
