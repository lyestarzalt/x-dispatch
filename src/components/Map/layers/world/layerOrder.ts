import type * as maplibregl from 'maplibre-gl';

/**
 * ID of the lowest layer in style order that is either one of `belowIds`
 * or the basemap's first label layer. Inserting before it keeps an overlay
 * under both the labels and any listed layer that already exists.
 */
export function lowestOf(map: maplibregl.Map, belowIds: ReadonlySet<string>): string | undefined {
  const layers = map.getStyle()?.layers;
  if (!layers) return undefined;
  for (const layer of layers) {
    if (belowIds.has(layer.id) || layer.type === 'symbol') return layer.id;
  }
  return undefined;
}

/**
 * Add `layer` below labels and below every existing layer in `belowIds`, or
 * move it there if it is already on the map. Idempotent, so it can run again
 * after a style change to restore the stacking.
 */
export function ensureLayerBelow(
  map: maplibregl.Map,
  layer: maplibregl.LayerSpecification,
  belowIds: ReadonlySet<string>
): void {
  const beforeId = lowestOf(map, belowIds);
  if (!map.getLayer(layer.id)) {
    map.addLayer(layer, beforeId);
    return;
  }
  if (beforeId && beforeId !== layer.id) {
    map.moveLayer(layer.id, beforeId);
  }
}
