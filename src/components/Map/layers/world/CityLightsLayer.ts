/**
 * Night-side city lights.
 *
 * Globe zooms: glowing points from the bundled populated-places list, each
 * carrying its own night factor. Regional zooms: the basemap's residential
 * areas, roads and buildings restyled as amber light, dimmed by the night
 * factor at the map centre. Both sit below labels.
 *
 * The basemap layers reference the basemap's own vector source, so they do
 * not survive a style change and are rebuilt by the owning hook on
 * `style.load`. The point layers are carried across by preserveCustomStyle.
 */
import type * as maplibregl from 'maplibre-gl';
import {
  BASEMAP_OPACITY_BINDINGS,
  CITY_LIGHTS_BASEMAP_LAYER_IDS,
  CITY_LIGHTS_PLACES_SOURCE_ID,
  CITY_LIGHTS_PLACE_LAYER_IDS,
  type PlaceLightCollection,
  basemapLightLayers,
  findOpenMapTilesSourceId,
  placeLightLayers,
  scaledZoomStops,
} from '@/lib/map/solar/cityLightsStyle';
import { safeAddGeoJSONSource, safeRemove } from '../types';
import { ensureLayerBelow } from './layerOrder';

const EMPTY: PlaceLightCollection = { type: 'FeatureCollection', features: [] };
const NO_LAYERS: ReadonlySet<string> = new Set();

/**
 * Add whatever is missing and restore the stacking order. Returns whether the
 * current basemap offers the vector layers the regional lights need.
 */
export function ensureCityLightsLayers(map: maplibregl.Map, night: number): boolean {
  const style = map.getStyle();
  if (!style) return false;

  // Bottom to top: every layer is placed just below the labels, so adding
  // them in order stacks them correctly; moving existing ones does the same.
  const basemapSourceId = findOpenMapTilesSourceId(style.sources);
  if (basemapSourceId) {
    for (const layer of basemapLightLayers(basemapSourceId, night)) {
      ensureLayerBelow(map, layer, NO_LAYERS);
    }
  }

  safeAddGeoJSONSource(map, CITY_LIGHTS_PLACES_SOURCE_ID, EMPTY);
  for (const layer of placeLightLayers()) {
    ensureLayerBelow(map, layer, NO_LAYERS);
  }

  return basemapSourceId !== null;
}

export function updateCityLightsPlaces(map: maplibregl.Map, data: PlaceLightCollection): void {
  const source = map.getSource(CITY_LIGHTS_PLACES_SOURCE_ID);
  if (source && 'setData' in source) {
    (source as maplibregl.GeoJSONSource).setData(data);
  }
}

/** Re-scale the regional layers for a new night factor at the map centre. */
export function updateCityLightsNight(map: maplibregl.Map, night: number): void {
  for (const binding of BASEMAP_OPACITY_BINDINGS) {
    if (!map.getLayer(binding.layerId)) continue;
    map.setPaintProperty(binding.layerId, binding.property, scaledZoomStops(binding.stops, night));
  }
}

export function removeCityLightsLayers(map: maplibregl.Map): void {
  safeRemove(map, () => {
    for (const id of [...CITY_LIGHTS_BASEMAP_LAYER_IDS, ...CITY_LIGHTS_PLACE_LAYER_IDS]) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    if (map.getSource(CITY_LIGHTS_PLACES_SOURCE_ID)) {
      map.removeSource(CITY_LIGHTS_PLACES_SOURCE_ID);
    }
  });
}
