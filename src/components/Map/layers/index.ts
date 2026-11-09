// Layer imports for registry
import {
  AirfieldLightsLayer,
  BeaconLayer,
  BoundaryLayer,
  GateLayer,
  LinearFeatureLayer,
  PavementLayer,
  RoutingNetworkLayer,
  RunwayEndLayer,
  RunwayLayer,
  RunwayLightsLayer,
  RunwayMarkingsLayer,
  TaxiwayNameLayer,
  TowerLayer,
  WindsockLayer,
} from './airport';
import type { LayerRenderer } from './airport/BaseLayerRenderer';

// Re-export base types
export { type LayerRenderer } from './airport/BaseLayerRenderer';

// Navigation layer singletons (consolidated)
export {
  airspaceLayer,
  ensureNavLayerOrder,
  firLayer,
  holdingPatternLayer,
  ilsLayer,
  navaidLayer,
} from './navigation';

// Dynamic layer functions
export {
  addFlightPlanLayer,
  fitMapToFlightPlan,
  removeFlightPlanLayer,
} from './dynamic/FlightPlanLayer';
export {
  addPlaneLayer,
  bringPlaneLayerToTop,
  removePlaneLayer,
  updatePlaneLayer,
} from './dynamic/PlaneLayer';
export {
  addProcedureRouteLayer,
  type PlanFix,
  removeProcedureRouteLayer,
  type RouteWaypoint,
} from './dynamic/ProcedureRouteLayer';
export { addRouteLineLayer, removeRouteLineLayer, updateRouteLine } from './dynamic/RouteLineLayer';
export {
  NAT_TRACKS_LAYER_IDS,
  addNatTracksLayer,
  removeNatTracksLayer,
} from './dynamic/NatTracksLayer';
export {
  addMeasureLayer,
  removeMeasureLayer,
  updateMeasureLine,
  MEASURE_HITBOX_LAYER_ID,
  MEASURE_VERTEX_HITBOX_LAYER_ID,
  MEASURE_LAYER_IDS,
} from './dynamic/MeasureLayer';
export {
  NETWORK_COLORS,
  addNetworkTrafficLayer,
  bringNetworkTrafficLayersToTop,
  networkTrafficLayerIds,
  removeNetworkTrafficLayer,
  setNetworkTrafficLayerVisibility,
  setupNetworkTrafficClickHandler,
  updateNetworkTrafficLayer,
} from './dynamic/NetworkTrafficLayer';
export {
  NETWORK_ROUTE_LAYER_IDS,
  bringNetworkRouteLayersToTop,
  removeNetworkRouteLayer,
  updateNetworkRouteLayer,
} from './dynamic/NetworkRouteLayer';
export {
  bringVatsimSectorLayersToTop,
  removeVatsimSectorLayer,
  updateVatsimSectorLayer,
} from './dynamic/VatsimSectorLayer';
export {
  NETWORK_ATC_LAYER_IDS,
  applyNetworkAtcTheme,
  bringNetworkAtcLayersToTop,
  removeNetworkAtcLayer,
  updateNetworkAtcLayer,
} from './dynamic/NetworkAtcLayer';
export {
  addRangeRingsLayer,
  removeRangeRingsLayer,
  updateRangeRingsData,
  RANGE_RINGS_LAYER_IDS,
} from './dynamic/RangeRingsLayer';
export type { RangeRingsConfig } from './dynamic/RangeRingsLayer';

export function createLayerRenderers(): LayerRenderer[] {
  return [
    new PavementLayer(),
    new BoundaryLayer(),
    new RunwayLayer(),
    new RunwayMarkingsLayer(),
    new LinearFeatureLayer(),
    new RunwayLightsLayer(),
    new AirfieldLightsLayer(),
    new GateLayer(),
    new RunwayEndLayer(),
    new WindsockLayer(),
    // new SignLayer(), // TODO: rework sign rendering
    new BeaconLayer(),
    new TowerLayer(),
    new TaxiwayNameLayer(),
    // Technical view of the routing graph — drawn last so it reads on top
    // of the surfaces it describes. Hidden by default via LayerVisibility.
    new RoutingNetworkLayer(),
  ];
}
