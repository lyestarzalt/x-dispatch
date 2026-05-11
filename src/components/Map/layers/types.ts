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
 * Idempotent GeoJSON-source add. If the source already exists, update its
 * data via setData(); otherwise add it fresh.
 *
 * MapLibre's `addSource` throws on duplicate IDs (see GeoJSONSource.id docs:
 * "Must not be used by any existing source"). Layers with an async init step
 * (loadImages, ensureIcons) can race: two concurrent calls both pass the
 * `remove()` step, both await, and the second `addSource` throws.
 *
 * Mirrors `BaseLayerRenderer.addSource()` for the airport-layer family.
 */
export function safeAddGeoJSONSource(
  map: maplibregl.Map,
  sourceId: string,
  data: GeoJSON.GeoJSON
): void {
  const existing = map.getSource(sourceId);
  if (existing && 'setData' in existing) {
    (existing as maplibregl.GeoJSONSource).setData(data);
    return;
  }
  map.addSource(sourceId, { type: 'geojson', data });
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
