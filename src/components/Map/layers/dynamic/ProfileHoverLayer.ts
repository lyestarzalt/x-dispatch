/**
 * The aircraft silhouette on the map that mirrors the point under the cursor on the vertical
 * profile, turned along the route. One source, one symbol layer, updated with setData.
 */
import type * as maplibregl from 'maplibre-gl';
import { safeAddGeoJSONSource } from '../types';
import { FALLBACK_ID, ensureFallbackIcon } from './aircraftIcons';

const SOURCE_ID = 'profile-hover-source';
const LAYER_ID = 'profile-hover-aircraft';

export const PROFILE_HOVER_LAYER_IDS = [LAYER_ID];

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

function addLayerIfReady(map: maplibregl.Map): void {
  if (map.getLayer(LAYER_ID) || !map.hasImage(FALLBACK_ID)) return;
  map.addLayer({
    id: LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'icon-image': FALLBACK_ID,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 4, 0.45, 10, 0.7],
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: {
      'icon-color': '#ffffff',
      'icon-halo-color': '#1DA0F2',
      'icon-halo-width': 1.5,
    },
  });
}

/** Place the marker at `position`, or hide it with null. */
export function setProfileHoverMarker(
  map: maplibregl.Map,
  position: { latitude: number; longitude: number; headingDeg: number } | null
): void {
  if (!map.getStyle()) return;
  safeAddGeoJSONSource(map, SOURCE_ID, EMPTY);
  if (!map.getLayer(LAYER_ID)) {
    // The silhouette is fetched once; the layer appears as soon as it is in.
    void ensureFallbackIcon(map).then(() => {
      if (map.getStyle() && map.getSource(SOURCE_ID)) addLayerIfReady(map);
    });
  }
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  source?.setData(
    position
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [position.longitude, position.latitude] },
              properties: { heading: position.headingDeg },
            },
          ],
        }
      : EMPTY
  );
}

export function removeProfileHoverLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
