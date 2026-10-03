import type { StartPosition } from '@/types/position';

type StartSpot = Pick<StartPosition, 'airport' | 'type' | 'latitude' | 'longitude'>;

/** A different spot; approach distance or tow edits on the current start don't count. */
export function isNewStartPosition(next: StartSpot | null, prev: StartSpot | null): boolean {
  if (!next) return false;
  return (
    next.airport !== prev?.airport ||
    next.type !== prev?.type ||
    next.latitude !== prev?.latitude ||
    next.longitude !== prev?.longitude
  );
}

export interface TaxiRouteSnapshot {
  mode: 'network' | 'freehand';
  networkNodeIds: readonly unknown[];
  waypoints: readonly unknown[];
  autoRouteResult: unknown;
}

function routePoints(s: TaxiRouteSnapshot): number {
  return s.mode === 'network' ? s.networkNodeIds.length : s.waypoints.length;
}

/** How a taxi route was built, the moment it first has two points; null otherwise. */
export function builtTaxiRoute(
  next: TaxiRouteSnapshot,
  prev: TaxiRouteSnapshot
): 'auto' | 'click' | 'freehand' | null {
  if (routePoints(next) < 2 || routePoints(prev) >= 2) return null;
  if (next.mode === 'freehand') return 'freehand';
  return next.autoRouteResult ? 'auto' : 'click';
}

export interface PlanProcedureSnapshot {
  departure: { sid?: unknown } | null;
  arrival: { star?: unknown; approach?: unknown } | null;
  autoRouting: boolean;
}

export interface ProcedurePick {
  type: 'sid' | 'star' | 'app';
  source: 'manual' | 'auto';
}

/** Procedures newly chosen in the plan builder; picks made while auto-routing count as automatic. */
export function pickedProcedures(
  next: PlanProcedureSnapshot,
  prev: PlanProcedureSnapshot
): ProcedurePick[] {
  const source = next.autoRouting ? 'auto' : 'manual';
  const picks: ProcedurePick[] = [];
  const changed = (a: unknown, b: unknown) => a !== undefined && a !== b;
  if (changed(next.departure?.sid, prev.departure?.sid)) picks.push({ type: 'sid', source });
  if (changed(next.arrival?.star, prev.arrival?.star)) picks.push({ type: 'star', source });
  if (changed(next.arrival?.approach, prev.arrival?.approach)) picks.push({ type: 'app', source });
  return picks;
}
