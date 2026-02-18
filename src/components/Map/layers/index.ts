// Layer imports for registry
import {
  BeaconLayer,
  BoundaryLayer,
  GateLayer,
  LinearFeatureLayer,
  PavementLayer,
  RunwayEndLayer,
  RunwayLayer,
  RunwayLightsLayer,
  RunwayMarkingsLayer,
  TaxiwayLayer,
  TaxiwayLightsLayer,
  TowerLayer,
  WindsockLayer,
} from './airport';
import type { LayerRenderer } from './airport/BaseLayerRenderer';

// Re-export base types
export { type LayerRenderer } from './airport/BaseLayerRenderer';

// Navigation layer singletons
export { airspaceLayer } from './airspace/AirspaceLayer';
export { firLayer } from './airspace/FIRLayer';
export {
  dmeLayer,
  highAirwayLayer,
  ilsLayer,
  lowAirwayLayer,
  ndbLayer,
  vorLayer,
  waypointLayer,
} from './navigation';

// Dynamic layer functions
export {
  addPlaneLayer,
  bringPlaneLayerToTop,
  removePlaneLayer,
  updatePlaneLayer,
} from './dynamic/PlaneLayer';
export { addProcedureRouteLayer, removeProcedureRouteLayer } from './dynamic/ProcedureRouteLayer';
export { addRouteLineLayer, removeRouteLineLayer, updateRouteLine } from './dynamic/RouteLineLayer';
export {
  bringVatsimLayersToTop,
  removeVatsimPilotLayer,
  setupVatsimClickHandler,
  updateVatsimPilotLayer,
} from './dynamic/VatsimLayer';

export function createLayerRenderers(): LayerRenderer[] {
  return [
    new PavementLayer(),
    new BoundaryLayer(),
    new TaxiwayLayer(),
    new RunwayLayer(),
    new RunwayMarkingsLayer(),
    new LinearFeatureLayer(),
    new RunwayLightsLayer(),
    new TaxiwayLightsLayer(),
    new GateLayer(),
    new RunwayEndLayer(),
    new WindsockLayer(),
    // new SignLayer(), // TODO: rework sign rendering
    new BeaconLayer(),
    new TowerLayer(),
  ];
}
