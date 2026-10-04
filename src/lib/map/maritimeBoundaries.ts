import type * as maplibregl from 'maplibre-gl';

/**
 * OpenMapTiles styles draw maritime borders, which follow coastlines out at sea
 * and mean nothing in the air. Boundary lines keep land borders only.
 */

const LAND_ONLY: maplibregl.ExpressionSpecification = ['!=', ['get', 'maritime'], 1];

/**
 * The filter plus a land-only test. Legacy filters cannot be combined with an
 * expression, so they come back unchanged.
 */
export function landOnlyFilter(
  filter: maplibregl.FilterSpecification | undefined
): maplibregl.FilterSpecification | undefined {
  if (filter === undefined) return LAND_ONLY;
  const text = JSON.stringify(filter);
  if (text.includes('maritime') || !text.includes('["get"')) return filter;
  return ['all', filter as maplibregl.ExpressionSpecification, LAND_ONLY];
}

/** Filters maritime borders out of every boundary line of the current style. */
export function hideMaritimeBoundaries(map: maplibregl.Map): void {
  for (const layer of map.getStyle()?.layers ?? []) {
    if (layer.type !== 'line' || layer['source-layer'] !== 'boundary') continue;
    const next = landOnlyFilter(layer.filter);
    if (next !== layer.filter) map.setFilter(layer.id, next);
  }
}
