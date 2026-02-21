/**
 * Flight Plan Route Layer
 * Renders the complete flight plan route on the map.
 */
import maplibregl from 'maplibre-gl';
import type { FMSFlightPlan } from '@/types/fms';

// Layer IDs
const SOURCE_ID = 'flightplan-route-source';
const WAYPOINT_SOURCE_ID = 'flightplan-waypoints-source';
const LINE_CASING_ID = 'flightplan-route-casing';
const LINE_ID = 'flightplan-route-line';
const WAYPOINTS_ID = 'flightplan-waypoints';
const LABELS_ID = 'flightplan-labels';

export const FLIGHTPLAN_LAYER_IDS = [LINE_CASING_ID, LINE_ID, WAYPOINTS_ID, LABELS_ID];

const COLORS = {
  line: '#06b6d4', // Cyan/teal
  casing: '#ffffff',
  airport: '#f97316', // Orange
  vor: '#14b8a6', // Teal
  ndb: '#14b8a6',
  fix: '#6b7280', // Gray
  latlon: '#6b7280',
};

export function addFlightPlanLayer(map: maplibregl.Map, fmsData: FMSFlightPlan): void {
  removeFlightPlanLayer(map);

  const waypoints = fmsData.waypoints;
  if (waypoints.length < 2) return;

  // Create route line GeoJSON
  const coordinates = waypoints.map((wp) => [wp.longitude, wp.latitude]);
  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {},
      },
    ],
  };

  // Create waypoints GeoJSON
  const waypointGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: waypoints.map((wp, index) => {
      let waypointType = 'fix';
      if (wp.type === 1) waypointType = 'airport';
      else if (wp.type === 2) waypointType = 'ndb';
      else if (wp.type === 3) waypointType = 'vor';
      else if (wp.type === 28) waypointType = 'latlon';

      return {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [wp.longitude, wp.latitude],
        },
        properties: {
          id: wp.id,
          waypointType,
          index,
          altitude: wp.altitude,
          via: wp.via,
        },
      };
    }),
  };

  // Add sources
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: routeGeoJSON,
  });

  map.addSource(WAYPOINT_SOURCE_ID, {
    type: 'geojson',
    data: waypointGeoJSON,
  });

  // Route casing (white outline)
  map.addLayer({
    id: LINE_CASING_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': COLORS.casing,
      'line-width': 5,
      'line-opacity': 0.9,
    },
  });

  // Main route line
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': COLORS.line,
      'line-width': 3,
      'line-opacity': 0.9,
    },
  });

  // Waypoint markers
  map.addLayer({
    id: WAYPOINTS_ID,
    type: 'circle',
    source: WAYPOINT_SOURCE_ID,
    paint: {
      'circle-radius': 5,
      'circle-color': [
        'match',
        ['get', 'waypointType'],
        'airport',
        COLORS.airport,
        'vor',
        COLORS.vor,
        'ndb',
        COLORS.ndb,
        COLORS.fix,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  // Waypoint labels
  map.addLayer({
    id: LABELS_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    layout: {
      'text-field': ['get', 'id'],
      'text-font': ['Open Sans Semibold'],
      'text-size': 11,
      'text-offset': [0, -1.5],
      'text-anchor': 'bottom',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#1a1a1a',
      'text-halo-color': '#ffffff',
      'text-halo-width': 1.5,
    },
  });
}

export function removeFlightPlanLayer(map: maplibregl.Map | null | undefined): void {
  if (!map) return;

  const layers = [LABELS_ID, WAYPOINTS_ID, LINE_ID, LINE_CASING_ID];
  const sources = [WAYPOINT_SOURCE_ID, SOURCE_ID];

  for (const layerId of layers) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  for (const sourceId of sources) {
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }
}

export function setFlightPlanVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  for (const layerId of FLIGHTPLAN_LAYER_IDS) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
}

export function fitMapToFlightPlan(map: maplibregl.Map, fmsData: FMSFlightPlan): void {
  const waypoints = fmsData.waypoints;
  if (waypoints.length === 0) return;

  const bounds = new maplibregl.LngLatBounds();
  waypoints.forEach((wp) => {
    bounds.extend([wp.longitude, wp.latitude]);
  });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 100, duration: 1500 });
  }
}
