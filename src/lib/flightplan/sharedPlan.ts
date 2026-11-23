/**
 * The flight plan every device shows: the plan drawn on the map and the planner's
 * draft. Main keeps the latest copy; the desktop window and each tablet push their
 * edits and apply the others'. The last edit wins.
 */
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import { isRecord } from '@/lib/utils/typeGuards';
import type { FlightPlanEndpoint, FlightPlanWaypoint } from '@/stores/flightPlanStore';
import type { EnrichedFlightPlan } from '@/types/fms';
import type { RangeRingCategory } from '@/types/layers';
import type { SimBriefOFP } from '@/types/simbrief';

/** What the map draws: a SimBrief OFP, a .fms file or the planner's hand-off. */
export interface MapPlanSnapshot {
  departure: FlightPlanEndpoint | null;
  arrival: FlightPlanEndpoint | null;
  route: FlightPlanWaypoint[];
  cruiseAltitude: number | null;
  fmsData: EnrichedFlightPlan | null;
  fileName: string | null;
  simbriefData: SimBriefOFP | null;
  showFlightPlanBar: boolean;
}

/** What the planner saves: the same fields `planBuilderStore` persists. */
export interface DraftSnapshot {
  departure: PlanEndpoint | null;
  arrival: PlanEndpoint | null;
  alternate: PlanEndpoint | null;
  aircraftClass: RangeRingCategory | null;
  routeText: string;
  cruiseAltitudeFt: number | null;
}

export interface SharedPlanDoc {
  /** Set by main on every push, so a late or echoed copy never replaces a newer one. */
  revision: number;
  /** The renderer that pushed it, so it can skip its own echo. */
  origin: string;
  map: MapPlanSnapshot;
  draft: DraftSnapshot;
}

/**
 * The same plan, not necessarily the same objects. The planner rebuilds an endpoint
 * when airport data arrives, and the station merge rebuilds `fmsData`; comparing by
 * content keeps two devices from pushing such identical copies back and forth.
 */
export function sameSnapshot<T extends object>(a: T, b: T): boolean {
  const keys = Object.keys(a) as (keyof T)[];
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) => a[key] === b[key] || JSON.stringify(a[key]) === JSON.stringify(b[key])
  );
}

/** IPC input is untrusted: the shape main needs before it stores and relays a document. */
export function isSharedPlanDoc(input: unknown): input is SharedPlanDoc {
  if (!isRecord(input)) return false;
  const { origin, map, draft } = input;
  if (typeof origin !== 'string' || !origin) return false;
  if (!isRecord(map) || !Array.isArray(map.route) || typeof map.showFlightPlanBar !== 'boolean') {
    return false;
  }
  return isRecord(draft) && typeof draft.routeText === 'string';
}
