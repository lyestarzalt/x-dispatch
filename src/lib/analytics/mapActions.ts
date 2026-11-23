import type { StartPosition } from '@/types/position';
import type { AnalyticsLayer } from './events';

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

/**
 * The map state each tracked layer's on/off is read from. The plane tracker and
 * follow-plane are left out and report from their buttons: the app switches the
 * tracker on when X-Plane connects, and any map drag switches follow-plane off.
 */
export interface MapLayerSnapshot {
  vatsimEnabled: boolean;
  ivaoEnabled: boolean;
  simTrafficEnabled: boolean;
  weatherRadarEnabled: boolean;
  cloudLayerEnabled: boolean;
  flightTrailEnabled: boolean;
  rangeRingsEnabled: boolean;
  terrain3dEnabled: boolean;
  terrainShadingEnabled: boolean;
  isNightMode: boolean;
  navVisibility: { navaids: boolean; ils: boolean; airspaces: boolean; airwaysMode: string };
}

const LAYER_STATE: ReadonlyArray<[AnalyticsLayer, (s: MapLayerSnapshot) => boolean]> = [
  ['vatsim', (s) => s.vatsimEnabled],
  ['ivao', (s) => s.ivaoEnabled],
  ['sim_traffic', (s) => s.simTrafficEnabled],
  ['weather_radar', (s) => s.weatherRadarEnabled],
  ['clouds', (s) => s.cloudLayerEnabled],
  ['flight_trail', (s) => s.flightTrailEnabled],
  ['range_rings', (s) => s.rangeRingsEnabled],
  ['terrain_3d', (s) => s.terrain3dEnabled],
  ['terrain_shading', (s) => s.terrainShadingEnabled],
  ['night_mode', (s) => s.isNightMode],
  ['navaids', (s) => s.navVisibility.navaids],
  ['ils', (s) => s.navVisibility.ils],
  ['airspaces', (s) => s.navVisibility.airspaces],
  ['airways', (s) => s.navVisibility.airwaysMode !== 'off'],
];

export interface LayerToggle {
  event: 'layer_enabled' | 'layer_disabled';
  layer: AnalyticsLayer;
}

/** Layers switched on or off between two map states. */
export function layerToggles(next: MapLayerSnapshot, prev: MapLayerSnapshot): LayerToggle[] {
  const toggles: LayerToggle[] = [];
  for (const [layer, isOn] of LAYER_STATE) {
    if (isOn(next) && !isOn(prev)) toggles.push({ event: 'layer_enabled', layer });
    if (!isOn(next) && isOn(prev)) toggles.push({ event: 'layer_disabled', layer });
  }
  return toggles;
}
