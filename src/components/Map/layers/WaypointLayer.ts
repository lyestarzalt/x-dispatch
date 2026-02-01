import maplibregl from 'maplibre-gl';
import {
  NAV_COLORS,
  NAV_LABEL_STYLES,
  NAV_SYMBOL_SIZES,
  NAV_ZOOM_LEVELS,
} from '@/config/navLayerConfig';
import type { Waypoint } from '@/types/navigation';

const LAYER_ID = 'nav-waypoints';
const SOURCE_ID = 'nav-waypoints-source';
const LABEL_LAYER_ID = 'nav-waypoints-labels';

function createWaypointGeoJSON(waypoints: Waypoint[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: waypoints.map((wp) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [wp.longitude, wp.latitude],
      },
      properties: {
        id: wp.id,
        region: wp.region,
      },
    })),
  };
}

export function addWaypointLayer(map: maplibregl.Map, waypoints: Waypoint[]): void {
  removeWaypointLayer(map);
  if (waypoints.length === 0) return;

  const geoJSON = createWaypointGeoJSON(waypoints);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  const sizes = NAV_SYMBOL_SIZES.waypoint;

  // Waypoint symbol - small circle
  map.addLayer({
    id: LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    minzoom: NAV_ZOOM_LEVELS.waypoints.symbols,
    paint: {
      'circle-color': NAV_COLORS.waypoint.standard,
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['zoom'],
        8,
        sizes.min,
        12,
        sizes.medium,
        16,
        sizes.max,
      ],
      'circle-stroke-width': 0,
      'circle-opacity': 0.7,
    },
  });

  // Waypoint labels - only at high zoom
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: NAV_ZOOM_LEVELS.waypoints.labels,
    layout: {
      'text-field': ['get', 'id'],
      'text-font': NAV_LABEL_STYLES.fonts.semibold,
      'text-size': NAV_LABEL_STYLES.textSize.waypoint,
      'text-offset': NAV_LABEL_STYLES.offset.waypoint,
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': NAV_COLORS.waypoint.standard,
      'text-halo-color': '#000000',
      'text-halo-width': NAV_LABEL_STYLES.haloWidth.small,
    },
  });
}

export function removeWaypointLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function updateWaypointLayer(map: maplibregl.Map, waypoints: Waypoint[]): void {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createWaypointGeoJSON(waypoints));
  } else {
    addWaypointLayer(map, waypoints);
  }
}

export function setWaypointLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

export const WAYPOINT_LAYER_IDS = [LAYER_ID, LABEL_LAYER_ID];
