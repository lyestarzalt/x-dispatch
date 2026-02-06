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
  SignLayer,
  TaxiwayLayer,
  TaxiwayLightsLayer,
  TowerLayer,
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
    new SignLayer(),
    new BeaconLayer(),
    new TowerLayer(),
  ];
}
