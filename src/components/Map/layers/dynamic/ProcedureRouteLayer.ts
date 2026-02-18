import maplibregl from 'maplibre-gl';

/** Waypoint with resolved coordinates for map rendering */
interface ResolvedWaypoint {
  fixId: string;
  latitude?: number;
  longitude?: number;
  resolved?: boolean; // If coordinates were successfully resolved
}

interface RouteData {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  waypoints: ResolvedWaypoint[];
}

const ROUTE_LAYER_ID = 'procedure-route';
const ROUTE_SOURCE_ID = 'procedure-route-source';
const WAYPOINT_LAYER_ID = 'procedure-waypoints';
const WAYPOINT_SOURCE_ID = 'procedure-waypoints-source';
const LABEL_LAYER_ID = 'procedure-waypoint-labels';
const UNRESOLVED_LAYER_ID = 'procedure-unresolved-waypoints';

// Colors by procedure type
const ROUTE_COLORS = {
  SID: '#00BFFF', // Light blue for departures
  STAR: '#FFD700', // Gold for arrivals
  APPROACH: '#FF6B6B', // Coral for approaches
};

function createRouteGeoJSON(waypoints: ResolvedWaypoint[]): GeoJSON.FeatureCollection {
  // Filter waypoints that have coordinates
  const validWaypoints = waypoints.filter(
    (wp) => wp.latitude !== undefined && wp.longitude !== undefined
  );

  if (validWaypoints.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  const coordinates = validWaypoints.map((wp) => [wp.longitude!, wp.latitude!]);

  return {
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
}

function createWaypointGeoJSON(waypoints: ResolvedWaypoint[]): GeoJSON.FeatureCollection {
  const validWaypoints = waypoints.filter(
    (wp) => wp.latitude !== undefined && wp.longitude !== undefined
  );

  return {
    type: 'FeatureCollection',
    features: validWaypoints.map((wp, idx) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [wp.longitude!, wp.latitude!],
      },
      properties: {
        id: wp.fixId,
        sequence: idx + 1,
        resolved: wp.resolved !== false, // Default to true for backward compatibility
      },
    })),
  };
}

function createUnresolvedWaypointsGeoJSON(
  waypoints: ResolvedWaypoint[],
  lastKnownPosition?: { lat: number; lon: number }
): GeoJSON.FeatureCollection {
  // For unresolved waypoints, we can't show them on the map without coordinates
  // This is a placeholder that shows unresolved waypoints at the last known position
  // or at the center of the route
  const unresolvedWaypoints = waypoints.filter(
    (wp) => wp.latitude === undefined || wp.longitude === undefined
  );

  if (unresolvedWaypoints.length === 0 || !lastKnownPosition) {
    return { type: 'FeatureCollection', features: [] };
  }

  // We don't have coordinates, so we can't place them anywhere meaningful
  // The caller should handle displaying a list of unresolved waypoints separately
  return { type: 'FeatureCollection', features: [] };
}

export function addProcedureRouteLayer(
  map: maplibregl.Map,
  route: RouteData,
  waypointCoords?: Map<string, { lat: number; lon: number }>
): void {
  removeProcedureRouteLayer(map);

  // Resolve waypoint coordinates
  // Prefer embedded coordinates (from procedureCoordResolver), fallback to external map
  const resolvedWaypoints: ResolvedWaypoint[] = route.waypoints.map((wp) => {
    // If waypoint already has embedded coordinates, use them
    if (wp.latitude !== undefined && wp.longitude !== undefined) {
      return {
        ...wp,
        resolved: wp.resolved !== false, // Preserve resolved flag if present
      };
    }

    // Otherwise, try to look up from external map
    const coords = waypointCoords?.get(wp.fixId.toUpperCase());
    return {
      ...wp,
      latitude: coords?.lat,
      longitude: coords?.lon,
      resolved: coords !== undefined,
    };
  });

  const routeGeoJSON = createRouteGeoJSON(resolvedWaypoints);
  const waypointGeoJSON = createWaypointGeoJSON(resolvedWaypoints);

  if (routeGeoJSON.features.length === 0) {
    return;
  }

  const color = ROUTE_COLORS[route.type];

  // Route line source
  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: routeGeoJSON,
  });

  // Waypoint source
  map.addSource(WAYPOINT_SOURCE_ID, {
    type: 'geojson',
    data: waypointGeoJSON,
  });

  // Route line layer
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    paint: {
      'line-color': color,
      'line-width': 3,
      'line-opacity': 0.8,
      'line-dasharray': route.type === 'APPROACH' ? [2, 1] : [1],
    },
  });

  // Waypoint circles
  map.addLayer({
    id: WAYPOINT_LAYER_ID,
    type: 'circle',
    source: WAYPOINT_SOURCE_ID,
    paint: {
      'circle-color': color,
      'circle-radius': 6,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#000000',
    },
  });

  // Waypoint labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    layout: {
      'text-field': ['concat', ['get', 'sequence'], '. ', ['get', 'id']],
      'text-font': ['Open Sans Semibold'],
      'text-size': 11,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': color,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });

  // Fit map to route
  const bounds = new maplibregl.LngLatBounds();
  resolvedWaypoints
    .filter((wp) => wp.latitude !== undefined && wp.longitude !== undefined)
    .forEach((wp) => {
      bounds.extend([wp.longitude!, wp.latitude!]);
    });

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 100, duration: 1000 });
  }
}

export function removeProcedureRouteLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(WAYPOINT_LAYER_ID)) map.removeLayer(WAYPOINT_LAYER_ID);
  if (map.getLayer(UNRESOLVED_LAYER_ID)) map.removeLayer(UNRESOLVED_LAYER_ID);
  if (map.getLayer(ROUTE_LAYER_ID)) map.removeLayer(ROUTE_LAYER_ID);
  if (map.getSource(WAYPOINT_SOURCE_ID)) map.removeSource(WAYPOINT_SOURCE_ID);
  if (map.getSource(ROUTE_SOURCE_ID)) map.removeSource(ROUTE_SOURCE_ID);
}

export function setProcedureRouteVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(ROUTE_LAYER_ID)) map.setLayoutProperty(ROUTE_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(WAYPOINT_LAYER_ID))
    map.setLayoutProperty(WAYPOINT_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

export const PROCEDURE_ROUTE_LAYER_IDS = [
  ROUTE_LAYER_ID,
  WAYPOINT_LAYER_ID,
  LABEL_LAYER_ID,
  UNRESOLVED_LAYER_ID,
];
