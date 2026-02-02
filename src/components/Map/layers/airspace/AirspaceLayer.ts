/**
 * Airspace Layer - Renders airspace boundaries
 * ICAO Standard Colors:
 * - Class B: Blue solid
 * - Class C: Magenta solid
 * - Class D: Blue dashed
 * - Class E: Magenta dashed
 * - Restricted/Prohibited: Red
 */
import maplibregl from 'maplibre-gl';
import type { Airspace } from '@/types/navigation';

const FILL_LAYER_ID = 'nav-airspaces-fill';
const OUTLINE_LAYER_ID = 'nav-airspaces-outline';
const LABEL_LAYER_ID = 'nav-airspaces-labels';
const SOURCE_ID = 'nav-airspaces-source';

// ICAO standard airspace colors - borders only
const AIRSPACE_STYLES: Record<string, { color: string; dashed: boolean }> = {
  A: { color: '#0066CC', dashed: false },
  B: { color: '#0066CC', dashed: false },
  C: { color: '#CC0099', dashed: false },
  D: { color: '#0066CC', dashed: true },
  E: { color: '#CC0099', dashed: true },
  F: { color: '#CC6600', dashed: true },
  G: { color: '#666666', dashed: true },
  CTR: { color: '#0066CC', dashed: false },
  TMA: { color: '#CC0099', dashed: false },
  R: { color: '#CC0000', dashed: false },
  P: { color: '#CC0000', dashed: false },
  Q: { color: '#CC0000', dashed: true },
  W: { color: '#CC6600', dashed: true },
  GP: { color: '#666666', dashed: true },
  OTHER: { color: '#666666', dashed: true },
};

function getAirspaceStyle(airspaceClass: string) {
  return AIRSPACE_STYLES[airspaceClass] || AIRSPACE_STYLES['OTHER'];
}

function createAirspaceGeoJSON(airspaces: Airspace[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: airspaces
      .filter((a) => a.coordinates.length >= 3)
      .map((airspace) => {
        const style = getAirspaceStyle(airspace.class);
        return {
          type: 'Feature' as const,
          geometry: {
            type: 'Polygon' as const,
            coordinates: [airspace.coordinates],
          },
          properties: {
            class: airspace.class,
            name: airspace.name,
            upperLimit: airspace.upperLimit,
            lowerLimit: airspace.lowerLimit,
            color: style.color,
            dashed: style.dashed ? 1 : 0,
          },
        };
      }),
  };
}

export function addAirspaceLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  removeAirspaceLayer(map);
  if (airspaces.length === 0) return;

  const geoJSON = createAirspaceGeoJSON(airspaces);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  map.addLayer({
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.02,
    },
  });

  // Outline layer - the main visual
  map.addLayer({
    id: OUTLINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1, 8, 1.5, 12, 2],
      'line-opacity': 0.6,
    },
  });

  // Labels at higher zoom
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 9,
    layout: {
      'text-field': ['concat', ['get', 'class'], ' ', ['get', 'name']],
      'text-font': ['Open Sans Semibold'],
      'text-size': 10,
      'text-allow-overlap': false,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': '#000000',
      'text-halo-width': 1,
      'text-opacity': 0.8,
    },
  });
}

function removeAirspaceLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
  if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

function updateAirspaceLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createAirspaceGeoJSON(airspaces));
  } else {
    addAirspaceLayer(map, airspaces);
  }
}

export function setAirspaceLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(OUTLINE_LAYER_ID))
    map.setLayoutProperty(OUTLINE_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

const AIRSPACE_LAYER_IDS = [FILL_LAYER_ID, OUTLINE_LAYER_ID, LABEL_LAYER_ID];
