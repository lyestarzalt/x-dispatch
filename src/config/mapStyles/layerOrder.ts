/**
 * Z-index ordering for airport feature layers
 * Lower values are rendered first (below), higher values on top
 */
export const LAYER_ORDER = {
  // Base surfaces (bottom)
  'airport-pavements': 0,
  'airport-boundaries': 1,

  // Major surfaces
  'airport-taxiways': 2,
  'airport-runways': 4,
  'airport-runway-shoulders': 5,

  // Markings on surfaces
  'airport-runway-centerlines': 6,
  'airport-linear-features-border': 7,
  'airport-linear-features': 8,
  'airport-linear-features-lighting': 9,

  // Point features
  'airport-startup-locations': 10,
  'airport-windsocks': 11,

  // Labels (top)
  'airport-signs': 12,
  'airport-runway-labels': 13,
  'airport-startup-location-labels': 14,
  'airport-windsock-labels': 15,
} as const;

export type LayerId = keyof typeof LAYER_ORDER;

/**
 * Get all layer IDs in render order (ascending z-index)
 */
export function getLayersInOrder(): LayerId[] {
  return (Object.entries(LAYER_ORDER) as [LayerId, number][])
    .sort(([, a], [, b]) => a - b)
    .map(([id]) => id);
}

/**
 * Get all layer IDs for removal (any order)
 */
export function getAllLayerIds(): LayerId[] {
  return Object.keys(LAYER_ORDER) as LayerId[];
}

/**
 * Get all source IDs (unique, derived from layer IDs)
 */
export function getAllSourceIds(): string[] {
  const sourceIds = new Set<string>();

  for (const layerId of getAllLayerIds()) {
    // Extract base source name (remove -border, -lighting, -labels suffixes)
    const sourceId = layerId
      .replace(/-border$/, '')
      .replace(/-lighting$/, '')
      .replace(/-labels$/, '')
      .replace(/-centerlines$/, '')
      .replace(/-shoulders$/, '');
    sourceIds.add(sourceId);
  }

  return Array.from(sourceIds);
}
