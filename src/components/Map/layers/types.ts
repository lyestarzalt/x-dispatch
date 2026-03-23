import maplibregl from 'maplibre-gl';

// TODO: Refactor all map layer management into a unified abstraction.
// Currently every layer file (dynamic/, airport/, navigation/) duplicates
// add/remove/visibility logic with inconsistent style-load guards
// (once('idle'), once('style.load'), once('styledata'), isStyleLoaded checks).
// A single LayerManager class should own the map reference, queue add/remove
// operations during style transitions, and provide a consistent lifecycle
// (add, update, remove, setVisibility) for all layer types.

/**
 * Run a map mutation (layer/source removal etc.) safely.
 * Bails out if the map style has been destroyed; otherwise runs synchronously.
 * If the style isn't fully loaded, defers to the next idle event.
 */
export function safeRemove(map: maplibregl.Map, fn: () => void): void {
  if (!map.getStyle()) return;
  if (map.isStyleLoaded()) {
    fn();
  } else {
    map.once('idle', () => {
      if (map.getStyle()) fn();
    });
  }
}

/**
 * Helper to safely remove layers and source.
 * Defers removal if the map is mid-render to prevent MapLibre crash.
 */
export function removeLayersAndSource(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
  additionalLayerIds?: string[]
): void {
  safeRemove(map, () => {
    if (additionalLayerIds) {
      for (const id of additionalLayerIds) {
        if (map.getLayer(id)) {
          map.removeLayer(id);
        }
      }
    }

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

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
