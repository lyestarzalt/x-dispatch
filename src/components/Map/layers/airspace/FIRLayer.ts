import maplibregl from 'maplibre-gl';
import {
  NAV_LABEL_STYLES,
  NAV_LINE_STYLES,
  NAV_ZOOM_LEVELS,
  getAirspaceColor,
} from '@/config/navLayerConfig';
import type { Airspace } from '@/types/navigation';

const SOURCE_ID = 'nav-global-airspace-source';
const LINE_LAYER_ID = 'nav-global-airspace-lines';
const LABEL_LAYER_ID = 'nav-global-airspace-labels';

function createGlobalAirspaceGeoJSON(airspaces: Airspace[]): GeoJSON.FeatureCollection {
  const filtered = airspaces.filter((a) => a.coordinates.length >= 3);
  return {
    type: 'FeatureCollection',
    features: filtered.map((airspace) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Polygon' as const,
        coordinates: [airspace.coordinates],
      },
      properties: {
        name: airspace.name,
        class: airspace.class,
        color: getAirspaceColor(airspace.class),
      },
    })),
  };
}

export function addFIRLayer(map: maplibregl.Map, airspaces: Airspace[]): void {
  removeFIRLayer(map);

  const geoJSON = createGlobalAirspaceGeoJSON(airspaces);
  if (geoJSON.features.length === 0) return;

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  map.addLayer({
    id: LINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    minzoom: NAV_ZOOM_LEVELS.firBoundaries.lines,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': NAV_LINE_STYLES.fir.width,
      'line-opacity': NAV_LINE_STYLES.fir.opacity,
    },
  });

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: NAV_ZOOM_LEVELS.firBoundaries.labels,
    layout: {
      'text-field': ['concat', ['get', 'class'], ' ', ['get', 'name']],
      'text-font': NAV_LABEL_STYLES.fonts.bold,
      'text-size': NAV_LABEL_STYLES.textSize.fir,
      'text-allow-overlap': false,
      'symbol-placement': 'point',
    },
    paint: {
      'text-color': ['get', 'color'],
      'text-halo-color': '#000000',
      'text-halo-width': NAV_LABEL_STYLES.haloWidth.medium,
    },
  });
}

function removeFIRLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function setFIRLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LINE_LAYER_ID)) map.setLayoutProperty(LINE_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

const FIR_LAYER_IDS = [LINE_LAYER_ID, LABEL_LAYER_ID];
