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

// Navigation layer visibility (consolidated navaids, ILS, airspaces, airways)
export interface NavLayerVisibility {
  /** All radio navaids: VOR, VORTAC, VOR-DME, NDB, DME, TACAN */
  navaids: boolean;
  /** ILS/LOC with cone and course line */
  ils: boolean;
  /** Airspace boundaries (Class A/B/C/D, FIR, etc.) */
  airspaces: boolean;
  /** Airways display mode */
  airwaysMode: AirwaysMode;
}

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

// Default navigation layer visibility (off by default, user enables as needed)
export const DEFAULT_NAV_VISIBILITY: NavLayerVisibility = {
  navaids: false,
  ils: false,
  airspaces: false,
  airwaysMode: 'off',
};

// Range Rings - aircraft category reach visualization
export type RangeRingCategory = 'jet' | 'turboprop' | 'prop';

export const ALL_RANGE_RING_CATEGORIES: RangeRingCategory[] = ['jet', 'turboprop', 'prop'];

export const DEFAULT_RANGE_RINGS_DURATION = 2;

/** Cruise speeds in knots per category */
export const RANGE_RING_SPEEDS: Record<RangeRingCategory, number> = {
  jet: 450,
  turboprop: 280,
  prop: 130,
};

/** MapLibre line colors per category */
export const RANGE_RING_COLORS: Record<RangeRingCategory, string> = {
  jet: '#38bdf8',
  turboprop: '#fbbf24',
  prop: '#34d399',
};

/** Short display labels per category */
export const RANGE_RING_LABELS: Record<RangeRingCategory, string> = {
  jet: 'JET',
  turboprop: 'TBP',
  prop: 'GA',
};
