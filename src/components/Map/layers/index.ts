// Layer imports for registry
import {
  BoundaryLayer,
  GateLayer,
  LinearFeatureLayer,
  PavementLayer,
  RunwayEndLayer,
  RunwayLayer,
  RunwayLightsLayer,
  RunwayMarkingsLayer,
  SignLayer,
  TaxiwayLayer,
  TaxiwayLightsLayer,
  WindsockLayer,
} from './airport';
import type { LayerRenderer } from './airport/BaseLayerRenderer';

// Re-export base types
export { type LayerRenderer } from './airport/BaseLayerRenderer';

// Re-export all layer implementations by category
export * from './airport';
export * from './navigation';
export * from './airspace';
export * from './dynamic';

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
