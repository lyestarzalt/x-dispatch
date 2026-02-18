import maplibregl from 'maplibre-gl';

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
