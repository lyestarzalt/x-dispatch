/**
 * Zoom-dependent visibility and rendering rules
 * Based on feature importance and typical viewing distances
 */

export interface ZoomBehavior {
  minZoom: number;
  maxZoom: number;
  fadeInRange?: number; // Zoom range over which feature fades in
}

/**
 * Default zoom behaviors for each feature type
 */
export const ZOOM_BEHAVIORS: Record<string, ZoomBehavior> = {
  // Large features visible from far away
  runways: {
    minZoom: 10,
    maxZoom: 24,
    fadeInRange: 1,
  },
  boundaries: {
    minZoom: 10,
    maxZoom: 24,
  },

  // Medium features
  taxiways: {
    minZoom: 12,
    maxZoom: 24,
    fadeInRange: 1,
  },
  pavements: {
    minZoom: 12,
    maxZoom: 24,
  },

  // Detailed features
  linearFeatures: {
    minZoom: 14,
    maxZoom: 24,
    fadeInRange: 1,
  },
  startupLocations: {
    minZoom: 14,
    maxZoom: 24,
  },
  windsocks: {
    minZoom: 14,
    maxZoom: 24,
  },

  // Very detailed features
  signs: {
    minZoom: 16,
    maxZoom: 24,
    fadeInRange: 0.5,
  },
  lighting: {
    minZoom: 15,
    maxZoom: 24,
  },
  labels: {
    minZoom: 14,
    maxZoom: 24,
  },
};

/**
 * Calculate optimal zoom level based on airport size (runway length)
 * Uses Haversine distance between runway ends
 */
export function calculateOptimalZoom(runwayLengthMeters: number): number {
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
export function getBoundsPadding(zoom: number): number {
  if (zoom >= 17) return 20;
  if (zoom >= 15) return 40;
  if (zoom >= 13) return 60;
  return 80;
}

/**
 * Build MapLibre opacity expression for zoom-based fading
 */
export function buildZoomOpacityExpression(
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
export function buildZoomFilter(minZoom: number): maplibregl.ExpressionFilterSpecification {
  return ['>=', ['zoom'], minZoom];
}
