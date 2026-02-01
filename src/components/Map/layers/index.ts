// Layer imports for registry
import type { LayerRenderer } from './BaseLayerRenderer';
import { BoundaryLayer } from './BoundaryLayer';
import { GateLayer } from './GateLayer';
import { LinearFeatureLayer } from './LinearFeatureLayer';
import { PavementLayer } from './PavementLayer';
import { RunwayEndLayer } from './RunwayEndLayer';
import { RunwayLayer } from './RunwayLayer';
import { RunwayLightsLayer } from './RunwayLightsLayer';
import { RunwayMarkingsLayer } from './RunwayMarkingsLayer';
import { SignLayer } from './SignLayer';
import { TaxiwayLayer } from './TaxiwayLayer';
import { TaxiwayLightsLayer } from './TaxiwayLightsLayer';
import { WindsockLayer } from './WindsockLayer';

// Re-export base types
export { BaseLayerRenderer, type LayerRenderer } from './BaseLayerRenderer';

// Re-export all layer implementations
export { PavementLayer } from './PavementLayer';
export { BoundaryLayer } from './BoundaryLayer';
export { TaxiwayLayer } from './TaxiwayLayer';
export { RunwayLayer } from './RunwayLayer';
export { RunwayMarkingsLayer } from './RunwayMarkingsLayer';
export { RunwayLightsLayer } from './RunwayLightsLayer';
export { TaxiwayLightsLayer } from './TaxiwayLightsLayer';
export { LinearFeatureLayer } from './LinearFeatureLayer';
export { SignLayer } from './SignLayer';
export { WindsockLayer } from './WindsockLayer';
export { StartupLocationLayer } from './StartupLocationLayer';
export { GateLayer } from './GateLayer';
export { RunwayEndLayer } from './RunwayEndLayer';

// Navigation layers
export * from './VORLayer';
export * from './NDBLayer';
export * from './DMELayer';
export * from './ILSLayer';
export * from './WaypointLayer';
export * from './AirspaceLayer';
export * from './FIRLayer';
export * from './AirwayLayer';
export * from './VatsimLayer';
export * from './ProcedureRouteLayer';

/**
 * Create all layer renderers in correct z-order
 * Order matters! Lower index = rendered first (below)
 */
export function createLayerRenderers(): LayerRenderer[] {
  return [
    new PavementLayer(),
    new BoundaryLayer(),
    new TaxiwayLayer(),
    new RunwayLayer(),
    new RunwayMarkingsLayer(),
    new LinearFeatureLayer(), // Painted lines only (no lights)
    new RunwayLightsLayer(), // Runway lights
    new TaxiwayLightsLayer(), // Taxiway lights (FAA-accurate)
    new GateLayer(),
    new RunwayEndLayer(),
    new WindsockLayer(),
    new SignLayer(),
  ];
}
