import type { Map as MapLibreMap } from 'maplibre-gl';
import type { OaciAirspaceFeature } from '@/modules/sia-france/lib/xml/airspaceParser';

const SOURCE_ID = 'oaci-airspaces';
const FILL_ID = 'oaci-airspaces-fill';
const LINE_ID = 'oaci-airspaces-line';

export function addOaciAirspaceLayer(map: MapLibreMap, features: OaciAirspaceFeature[]): void {
  removeOaciAirspaceLayer(map);
  if (features.length === 0) return;

  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: features.map((f) => ({
      type: 'Feature',
      properties: {
        name: f.name,
        class: f.airspaceClass,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [[...f.coordinates, f.coordinates[0]!]],
      },
    })),
  };

  map.addSource(SOURCE_ID, { type: 'geojson', data: geojson });
  map.addLayer({
    id: FILL_ID,
    type: 'fill',
    source: SOURCE_ID,
    paint: {
      'fill-color': '#f97316',
      'fill-opacity': 0.12,
    },
  });
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': '#f97316',
      'line-width': 1,
    },
  });
}

export function removeOaciAirspaceLayer(map: MapLibreMap): void {
  if (map.getLayer(LINE_ID)) map.removeLayer(LINE_ID);
  if (map.getLayer(FILL_ID)) map.removeLayer(FILL_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function setOaciAirspaceVisibility(map: MapLibreMap, visible: boolean): void {
  const v = visible ? 'visible' : 'none';
  if (map.getLayer(FILL_ID)) map.setLayoutProperty(FILL_ID, 'visibility', v);
  if (map.getLayer(LINE_ID)) map.setLayoutProperty(LINE_ID, 'visibility', v);
}
