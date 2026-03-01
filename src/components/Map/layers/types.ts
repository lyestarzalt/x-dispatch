import maplibregl from 'maplibre-gl';

/**
 * Run a map mutation (layer/source removal etc.) safely.
 * If the map style isn't fully loaded (mid-render), defers to the next idle event.
 */
export function safeRemove(map: maplibregl.Map, fn: () => void): void {
  if (!map.isStyleLoaded()) {
    map.once('idle', fn);
  } else {
    fn();
  }
}

/**
 * Helper to safely remove layers and source.
 * Defers removal if map is mid-render to prevent MapLibre crash.
 */
export function removeLayersAndSource(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
  additionalLayerIds?: string[]
): void {
  safeRemove(map, () => {
    // Remove additional layers first
    if (additionalLayerIds) {
      for (const id of additionalLayerIds) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }
    }

    // Remove main layer
    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    // Remove source
    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  });
}

/**
 * Helper to set visibility on multiple layers
 */
export function setLayersVisibility(
  map: maplibregl.Map,
  layerIds: string[],
  visible: boolean
): void {
  const visibility = visible ? 'visible' : 'none';
  for (const id of layerIds) {
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, 'visibility', visibility);
    }
  }
}
