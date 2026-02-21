// Navigation layer singletons

// Consolidated navaid layer (VOR, NDB, DME, TACAN)
export { navaidLayer, NAVAID_LAYER_IDS } from './NavaidLayer';

// Airspace layers (local + FIR)
export { airspaceLayer, firLayer, AIRSPACE_LAYER_IDS, FIR_LAYER_IDS } from './AirspaceLayer';

// ILS layer (complex - has cone and course geometry)
export { ilsLayer, ILS_LAYER_IDS } from './ILSLayer';

// Holding pattern layer
export { holdingPatternLayer, HOLDING_PATTERN_LAYER_IDS } from './HoldingPatternLayer';

// Base class for custom layers
export { NavLayerRenderer } from './NavLayerRenderer';
