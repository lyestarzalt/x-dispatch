/**
 * Zoom-dependent visibility and rendering rules
 * Based on feature importance and typical viewing distances
 */

interface ZoomBehavior {
  minZoom: number;
  maxZoom: number;
  fadeInRange?: number; // Zoom range over which feature fades in
}

type ZoomBehaviorKey =
  | 'runways'
  | 'runwayEnds'
  | 'runwayMarkings'
  | 'boundaries'
  | 'taxiways'
  | 'pavements'
  | 'linearFeatures'
  | 'startupLocations'
  | 'windsocks'
  | 'tower'
  | 'beacon'
  | 'signs'
  | 'lighting'
  | 'labels'
  | 'taxiwayNames';

/**
 * Named zoom level thresholds — single source of truth.
 * Adjust these to shift entire groups of features at once.
 */
const ZOOM_LEVEL = {
  FAR: 10, // Runways, boundaries — visible from high altitude
  MEDIUM: 12, // Taxiways, pavements, beacon
  CLOSE: 13, // Runway ends, tower, approach lights, runway numbers
  DETAILED: 14, // Linear features, gates, windsocks, labels, markings
  FINE: 15, // Lighting, TDZ marks
  ULTRA: 16, // Signs
  MAX: 24, // MapLibre max
} as const;

/**
 * Default zoom behaviors for each feature type
 */
export const ZOOM_BEHAVIORS: Record<ZoomBehaviorKey, ZoomBehavior> = {
  // Large features visible from far away
  runways: {
    minZoom: ZOOM_LEVEL.FAR,
    maxZoom: ZOOM_LEVEL.MAX,
    fadeInRange: 1,
  },
  runwayEnds: {
    minZoom: ZOOM_LEVEL.CLOSE,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  runwayMarkings: {
    minZoom: ZOOM_LEVEL.DETAILED,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  boundaries: {
    minZoom: ZOOM_LEVEL.FAR,
    maxZoom: ZOOM_LEVEL.MAX,
  },

  // Medium features
  taxiways: {
    minZoom: ZOOM_LEVEL.MEDIUM,
    maxZoom: ZOOM_LEVEL.MAX,
    fadeInRange: 1,
  },
  pavements: {
    minZoom: ZOOM_LEVEL.MEDIUM,
    maxZoom: ZOOM_LEVEL.MAX,
  },

  // Detailed features
  linearFeatures: {
    minZoom: ZOOM_LEVEL.DETAILED,
    maxZoom: ZOOM_LEVEL.MAX,
    fadeInRange: 1,
  },
  startupLocations: {
    minZoom: ZOOM_LEVEL.DETAILED,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  windsocks: {
    minZoom: ZOOM_LEVEL.DETAILED,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  tower: {
    minZoom: ZOOM_LEVEL.CLOSE,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  beacon: {
    minZoom: ZOOM_LEVEL.MEDIUM,
    maxZoom: ZOOM_LEVEL.MAX,
  },

  // Very detailed features
  signs: {
    minZoom: ZOOM_LEVEL.ULTRA,
    maxZoom: ZOOM_LEVEL.MAX,
    fadeInRange: 0.5,
  },
  lighting: {
    minZoom: ZOOM_LEVEL.FINE,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  labels: {
    minZoom: ZOOM_LEVEL.DETAILED,
    maxZoom: ZOOM_LEVEL.MAX,
  },
  taxiwayNames: {
    minZoom: ZOOM_LEVEL.MEDIUM,
    maxZoom: ZOOM_LEVEL.MAX,
  },
};

/**
 * Calculate optimal zoom level based on airport size (runway length)
 * Uses Haversine distance between runway ends
 */
function calculateOptimalZoom(runwayLengthMeters: number): number {
  // Approximate relationship between runway length and ideal zoom
  // Smaller airports need higher zoom, larger airports need lower zoom
  if (runwayLengthMeters > 4000) return 13; // Large international airports (KJFK, EGLL)
  if (runwayLengthMeters > 3000) return 14; // Major airports
  if (runwayLengthMeters > 2000) return 15; // Regional airports
  if (runwayLengthMeters > 1000) return 16; // Small airports
  if (runwayLengthMeters > 500) return 17; // GA airports
  return 18; // Very small airfields
}

/**
 * Get bounds padding based on zoom level
 * Higher zoom = less padding needed
 */
function getBoundsPadding(zoom: number): number {
  if (zoom >= 17) return 20;
  if (zoom >= 15) return 40;
  if (zoom >= 13) return 60;
  return 80;
}

/**
 * Build MapLibre opacity expression for zoom-based fading
 */
function buildZoomOpacityExpression(
  behavior: ZoomBehavior,
  baseOpacity = 1
): maplibregl.ExpressionSpecification {
  const fadeRange = behavior.fadeInRange ?? 0;

  if (fadeRange <= 0) {
    // No fade, just step visibility
    return [
      'step',
      ['zoom'],
      0,
      behavior.minZoom,
      baseOpacity,
    ] as maplibregl.ExpressionSpecification;
  }

  // Interpolate opacity over fade range
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    behavior.minZoom - fadeRange,
    0,
    behavior.minZoom,
    baseOpacity,
  ] as maplibregl.ExpressionSpecification;
}

/**
 * Build MapLibre filter for zoom-based visibility
 */
function buildZoomFilter(minZoom: number): maplibregl.ExpressionFilterSpecification {
  return ['>=', ['zoom'], minZoom];
}
