import maplibregl from 'maplibre-gl';

/**
 * Base interface for all layer renderers
 */
export interface BaseRenderer {
  /** Main layer identifier */
  layerId: string;
  /** Source identifier for GeoJSON data */
  sourceId: string;
  /** Additional layer IDs this renderer creates (labels, borders, etc.) */
  additionalLayerIds?: string[];

  /** Remove all layers and sources from the map */
  remove(map: maplibregl.Map): void;

  /** Set visibility of all layers */
  setVisibility(map: maplibregl.Map, visible: boolean): void;
}

/**
 * Helper to safely remove layers and source
 */
export function removeLayersAndSource(
  map: maplibregl.Map,
  layerId: string,
  sourceId: string,
  additionalLayerIds?: string[]
): void {
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
