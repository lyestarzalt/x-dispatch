/**
 * Procedure Route Layer
 * Renders SID, STAR, and Approach routes with cartographically accurate styling.
 *
 * Styling follows aviation chart conventions:
 * - Bold black/dark lines for procedure tracks
 * - Waypoint symbols (triangles for flyover, dots for flyby)
 * - Altitude constraints displayed at waypoints
 * - Speed constraints displayed at waypoints
 * - Different styling for departure vs arrival vs approach
 */
import maplibregl from 'maplibre-gl';
import type { AltitudeConstraint, ResolvedProcedureWaypoint } from '@/types/navigation';

// ============================================================================
// Types
// ============================================================================

export interface RouteWaypoint {
  fixId: string;
  latitude?: number;
  longitude?: number;
  resolved?: boolean;
  /** Altitude constraint */
  altitude?: AltitudeConstraint | null;
  /** Speed constraint in knots */
  speed?: number | null;
  /** Is this a flyover waypoint? */
  flyover?: boolean;
  /** Path terminator type */
  pathTerminator?: string;
}

export interface RouteData {
  type: 'SID' | 'STAR' | 'APPROACH' | 'ROUTE';
  name: string;
  waypoints: RouteWaypoint[];
  /** Transition altitude for the airport */
  transitionAlt?: number;
}

// ============================================================================
// Layer IDs
// ============================================================================

const ROUTE_LAYER_ID = 'procedure-route';
const ROUTE_CASING_LAYER_ID = 'procedure-route-casing';
const ROUTE_SOURCE_ID = 'procedure-route-source';
const WAYPOINT_LAYER_ID = 'procedure-waypoints';
const WAYPOINT_SOURCE_ID = 'procedure-waypoints-source';
const LABEL_LAYER_ID = 'procedure-waypoint-labels';
const CONSTRAINT_LAYER_ID = 'procedure-constraints';

// ============================================================================
// Aviation Chart Color Palette
// ============================================================================

const COLORS = {
  // Procedure tracks - using Jeppesen-inspired colors
  SID: {
    line: '#1a1a1a', // Dark gray/black for departure
    casing: '#ffffff',
    waypoint: '#0066cc', // Blue waypoint fill
    waypointStroke: '#003366',
    label: '#1a1a1a',
    constraint: '#cc0000', // Red for altitude constraints
  },
  STAR: {
    line: '#1a1a1a', // Dark gray/black for arrival
    casing: '#ffffff',
    waypoint: '#006633', // Green waypoint fill
    waypointStroke: '#003311',
    label: '#1a1a1a',
    constraint: '#cc0000',
  },
  APPROACH: {
    line: '#000000', // Solid black for approach
    casing: '#ffffff',
    waypoint: '#990000', // Dark red for approach waypoints
    waypointStroke: '#660000',
    label: '#000000',
    constraint: '#cc0000',
  },
  ROUTE: {
    line: '#6600cc', // Purple for enroute
    casing: '#ffffff',
    waypoint: '#6600cc',
    waypointStroke: '#330066',
    label: '#6600cc',
    constraint: '#cc6600',
  },
};

// Line widths (thicker for visibility)
const LINE_WIDTH = {
  route: 4, // Main route line
  casing: 6, // White casing for contrast
  waypointRadius: 5,
  waypointStroke: 2,
};

// ============================================================================
// Altitude Constraint Formatting
// ============================================================================

function formatAltitudeConstraint(alt: AltitudeConstraint | null | undefined): string {
  if (!alt || alt.altitude1 === null) return '';

  const alt1 = alt.altitude1;
  const alt2 = alt.altitude2;

  // Format altitude (FL for >= 18000, otherwise feet)
  const formatAlt = (a: number): string => {
    if (a >= 18000) {
      return `FL${Math.round(a / 100)}`;
    }
    return `${a}'`;
  };

  switch (alt.descriptor) {
    case '+':
      return `↑${formatAlt(alt1)}`; // At or above
    case '-':
      return `↓${formatAlt(alt1)}`; // At or below
    case '@':
      return formatAlt(alt1); // At exactly
    case 'B':
      if (alt2 !== null) {
        return `${formatAlt(alt2)}-${formatAlt(alt1)}`; // Between
      }
      return formatAlt(alt1);
    default:
      return formatAlt(alt1);
  }
}

function formatSpeedConstraint(speed: number | null | undefined): string {
  if (!speed) return '';
  return `${speed}KT`;
}

// ============================================================================
// GeoJSON Generators
// ============================================================================

function createRouteGeoJSON(waypoints: RouteWaypoint[]): GeoJSON.FeatureCollection {
  const validWaypoints = waypoints.filter(
    (wp) => wp.latitude !== undefined && wp.longitude !== undefined && wp.resolved !== false
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

function createWaypointGeoJSON(
  waypoints: RouteWaypoint[],
  routeType: RouteData['type']
): GeoJSON.FeatureCollection {
  const validWaypoints = waypoints.filter(
    (wp) => wp.latitude !== undefined && wp.longitude !== undefined && wp.resolved !== false
  );

  return {
    type: 'FeatureCollection',
    features: validWaypoints.map((wp, idx) => {
      const altText = formatAltitudeConstraint(wp.altitude);
      const spdText = formatSpeedConstraint(wp.speed);

      // Build constraint label
      let constraintLabel = '';
      if (altText && spdText) {
        constraintLabel = `${altText}\n${spdText}`;
      } else if (altText) {
        constraintLabel = altText;
      } else if (spdText) {
        constraintLabel = spdText;
      }

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [wp.longitude!, wp.latitude!],
        },
        properties: {
          id: wp.fixId,
          sequence: idx + 1,
          flyover: wp.flyover ?? false,
          pathTerminator: wp.pathTerminator ?? '',
          hasAltitude: !!altText,
          hasSpeed: !!spdText,
          constraintLabel,
          // Full label includes sequence, ID, and constraints
          fullLabel: `${wp.fixId}`,
        },
      };
    }),
  };
}

// ============================================================================
// Layer Management
// ============================================================================

export function addProcedureRouteLayer(
  map: maplibregl.Map,
  route: RouteData,
  waypointCoords?: Map<string, { lat: number; lon: number }>
): void {
  removeProcedureRouteLayer(map);

  // Resolve waypoint coordinates if needed
  const resolvedWaypoints: RouteWaypoint[] = route.waypoints.map((wp) => {
    if (wp.latitude !== undefined && wp.longitude !== undefined) {
      return { ...wp, resolved: wp.resolved !== false };
    }

    const coords = waypointCoords?.get(wp.fixId.toUpperCase());
    return {
      ...wp,
      latitude: coords?.lat,
      longitude: coords?.lon,
      resolved: coords !== undefined,
    };
  });

  const routeGeoJSON = createRouteGeoJSON(resolvedWaypoints);
  const waypointGeoJSON = createWaypointGeoJSON(resolvedWaypoints, route.type);

  if (routeGeoJSON.features.length === 0) {
    return;
  }

  const colors = COLORS[route.type];

  // Add sources
  map.addSource(ROUTE_SOURCE_ID, {
    type: 'geojson',
    data: routeGeoJSON,
  });

  map.addSource(WAYPOINT_SOURCE_ID, {
    type: 'geojson',
    data: waypointGeoJSON,
  });

  // Route casing (white outline for contrast)
  map.addLayer({
    id: ROUTE_CASING_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': colors.casing,
      'line-width': LINE_WIDTH.casing,
      'line-opacity': 0.9,
    },
  });

  // Main route line
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': colors.line,
      'line-width': LINE_WIDTH.route,
      'line-opacity': 1,
      // Dashed for approach
      ...(route.type === 'APPROACH' ? { 'line-dasharray': [4, 2] } : {}),
    },
  });

  // Waypoint symbols
  map.addLayer({
    id: WAYPOINT_LAYER_ID,
    type: 'circle',
    source: WAYPOINT_SOURCE_ID,
    paint: {
      'circle-color': colors.waypoint,
      'circle-radius': [
        'case',
        ['get', 'flyover'],
        LINE_WIDTH.waypointRadius + 2, // Larger for flyover
        LINE_WIDTH.waypointRadius,
      ],
      'circle-stroke-width': LINE_WIDTH.waypointStroke,
      'circle-stroke-color': colors.waypointStroke,
    },
  });

  // Waypoint ID labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    layout: {
      'text-field': ['get', 'fullLabel'],
      'text-font': ['Open Sans Bold'],
      'text-size': 12,
      'text-offset': [0, -1.8],
      'text-anchor': 'bottom',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': colors.label,
      'text-halo-color': '#ffffff',
      'text-halo-width': 2,
    },
  });

  // Altitude/Speed constraint labels (below waypoint)
  map.addLayer({
    id: CONSTRAINT_LAYER_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    filter: ['any', ['get', 'hasAltitude'], ['get', 'hasSpeed']],
    layout: {
      'text-field': ['get', 'constraintLabel'],
      'text-font': ['Open Sans Semibold'],
      'text-size': 10,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-line-height': 1.2,
    },
    paint: {
      'text-color': colors.constraint,
      'text-halo-color': '#ffffff',
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
  const layers = [
    CONSTRAINT_LAYER_ID,
    LABEL_LAYER_ID,
    WAYPOINT_LAYER_ID,
    ROUTE_LAYER_ID,
    ROUTE_CASING_LAYER_ID,
  ];
  const sources = [WAYPOINT_SOURCE_ID, ROUTE_SOURCE_ID];

  for (const layerId of layers) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
  for (const sourceId of sources) {
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  }
}

export function setProcedureRouteVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  const layers = [
    CONSTRAINT_LAYER_ID,
    LABEL_LAYER_ID,
    WAYPOINT_LAYER_ID,
    ROUTE_LAYER_ID,
    ROUTE_CASING_LAYER_ID,
  ];

  for (const layerId of layers) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
}

export const PROCEDURE_ROUTE_LAYER_IDS = [
  ROUTE_CASING_LAYER_ID,
  ROUTE_LAYER_ID,
  WAYPOINT_LAYER_ID,
  LABEL_LAYER_ID,
  CONSTRAINT_LAYER_ID,
];
