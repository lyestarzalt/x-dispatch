// Airport layer visibility (surfaces, markings, lights, objects, effects)
export interface LayerVisibility {
  // Surfaces
  runways: boolean;
  taxiways: boolean;
  pavements: boolean;
  boundaries: boolean;

  // Markings
  runwayMarkings: boolean;
  linearFeatures: boolean;
  signs: boolean;

  // Lights
  runwayLights: boolean;
  taxiwayLights: boolean;
  approachLights: boolean;

  // Objects
  gates: boolean;
  windsocks: boolean;

  // Effects
  animations: boolean;
  weather: boolean;
}

// Airways display mode - radio selection (only one at a time)
export type AirwaysMode = 'off' | 'high' | 'low';

// Navigation layer visibility (navaids, airspaces, airways)
export interface NavLayerVisibility {
  vors: boolean;
  ndbs: boolean;
  dmes: boolean;
  ils: boolean;
  waypoints: boolean;
  airspaces: boolean;
  airwaysMode: AirwaysMode;
}

interface UnifiedLayerVisibility extends LayerVisibility, NavLayerVisibility {}

// Default airport layer visibility
export const DEFAULT_LAYER_VISIBILITY: LayerVisibility = {
  runways: true,
  runwayMarkings: true,
  runwayLights: true,
  taxiways: true,
  taxiwayLights: true,
  linearFeatures: true,
  signs: true,
  gates: true,
  windsocks: true,
  boundaries: true,
  pavements: true,
  approachLights: true,
  animations: true,
  weather: true,
};

// Default navigation layer visibility - show key navaids by default
export const DEFAULT_NAV_VISIBILITY: NavLayerVisibility = {
  vors: true,
  ndbs: true,
  dmes: false,
  ils: true,
  waypoints: false,
  airspaces: true,
  airwaysMode: 'off',
};
