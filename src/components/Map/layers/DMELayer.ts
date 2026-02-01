import maplibregl from 'maplibre-gl';
import type { Navaid } from '@/types/navigation';

const LAYER_ID = 'nav-dmes';
const SOURCE_ID = 'nav-dmes-source';
const LABEL_LAYER_ID = 'nav-dmes-labels';

const DME_COLOR = '#0099CC';

function createDMEGeoJSON(dmes: Navaid[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: dmes.map((dme) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [dme.longitude, dme.latitude],
      },
      properties: {
        id: dme.id,
        name: dme.name,
        frequency: dme.frequency,
        freqDisplay: `${(dme.frequency / 100).toFixed(2)}`,
      },
    })),
  };
}

export function addDMELayer(map: maplibregl.Map, dmes: Navaid[]): void {
  removeDMELayer(map);
  if (dmes.length === 0) return;

  const geoJSON = createDMEGeoJSON(dmes);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  // DME symbol - small square outline
  map.addLayer({
    id: LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': 'transparent',
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 2, 10, 4, 14, 6],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': DME_COLOR,
    },
  });

  // DME labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 9,
    layout: {
      'text-field': ['get', 'id'],
      'text-font': ['Open Sans Semibold'],
      'text-size': 9,
      'text-offset': [0, 0.8],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': DME_COLOR,
      'text-halo-color': '#000000',
      'text-halo-width': 1,
    },
  });
}

export function removeDMELayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function updateDMELayer(map: maplibregl.Map, dmes: Navaid[]): void {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createDMEGeoJSON(dmes));
  } else {
    addDMELayer(map, dmes);
  }
}

export function setDMELayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

export const DME_LAYER_IDS = [LAYER_ID, LABEL_LAYER_ID];
