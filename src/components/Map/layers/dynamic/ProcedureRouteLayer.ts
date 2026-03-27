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
import { createHoldingPattern, createProcedureTurn, interpolateRFArc } from '@/lib/utils/geomath';
import type { LonLat } from '@/types/geo';
import type {
  AltitudeConstraint,
  ResolvedProcedureWaypoint,
  TurnDirection,
} from '@/types/navigation';

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
  /** Course/bearing in degrees (used for RF, HA/HF/HM, PI legs) */
  course?: number | null;
  /** Distance in nautical miles (used for RF radius, hold leg length) */
  distance?: number | null;
  /** Turn direction for arcs and holds */
  turnDirection?: TurnDirection | null;
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
  // High contrast colors - visible on both dark and light backgrounds
  SID: {
    line: '#00ffff', // Cyan
    casing: '#000000',
    waypoint: '#00ffff',
    waypointStroke: '#000000',
    label: '#ffffff',
    constraint: '#ffff00',
  },
  STAR: {
    line: '#00ff00', // Lime green
    casing: '#000000',
    waypoint: '#00ff00',
    waypointStroke: '#000000',
    label: '#ffffff',
    constraint: '#ffff00',
  },
  APPROACH: {
    line: '#ffff00', // Yellow - highest visibility
    casing: '#000000',
    waypoint: '#ffff00',
    waypointStroke: '#000000',
    label: '#ffffff',
    constraint: '#ffff00',
  },
  ROUTE: {
    line: '#ff66ff', // Pink
    casing: '#000000',
    waypoint: '#ff66ff',
    waypointStroke: '#000000',
    label: '#ffffff',
    constraint: '#ffff00',
  },
};

// Line widths
const LINE_WIDTH = {
  route: 5, // Main route line
  casing: 8, // Dark casing for contrast
  waypointRadius: 4, // Smaller waypoints
  waypointStroke: 1.5,
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

/**
 * Create route GeoJSON with path-terminator-aware geometry
 * Handles RF arcs, holding patterns, and procedure turns
 */
function createRouteGeoJSON(waypoints: RouteWaypoint[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const validWaypoints = waypoints.filter(
    (wp) => wp.latitude !== undefined && wp.longitude !== undefined && wp.resolved !== false
  );

  if (validWaypoints.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  const allCoordinates: LonLat[] = [];

  for (let i = 0; i < validWaypoints.length; i++) {
    const wp = validWaypoints[i];
    if (!wp) continue;
    const currentPos: LonLat = [wp.longitude!, wp.latitude!];

    if (i === 0) {
      allCoordinates.push(currentPos);
      continue;
    }

    const prevWp = validWaypoints[i - 1];
    if (!prevWp) continue;
    const prevPos: LonLat = [prevWp.longitude!, prevWp.latitude!];

    switch (wp.pathTerminator) {
      case 'RF':
        // Constant radius arc (Radius to Fix)
        if (wp.course != null && wp.distance != null && wp.turnDirection) {
          try {
            const arcPoints = interpolateRFArc(
              prevPos,
              currentPos,
              wp.course,
              wp.distance,
              wp.turnDirection
            );
            // Skip first point (duplicate of prevPos)
            allCoordinates.push(...arcPoints.slice(1));
          } catch {
            // Fallback to straight line if arc calculation fails
            allCoordinates.push(currentPos);
          }
        } else {
          // Missing arc parameters, fall back to straight line
          allCoordinates.push(currentPos);
        }
        break;

      case 'HA':
      case 'HF':
      case 'HM':
        // Holding pattern - add as separate feature (racetrack shape)
        if (wp.course != null && wp.turnDirection) {
          try {
            const holdPattern = createHoldingPattern(
              currentPos,
              wp.course,
              wp.distance ?? 1.0,
              wp.turnDirection
            );
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: holdPattern },
              properties: { type: 'holding', fixId: wp.fixId },
            });
          } catch {
            // Ignore holding pattern rendering errors
          }
        }
        // Still add the waypoint position to the main route
        allCoordinates.push(currentPos);
        break;

      case 'PI':
        // Procedure turn (45/180 pattern) - add as separate feature
        if (wp.course != null && wp.turnDirection) {
          try {
            const ptGeom = createProcedureTurn(
              prevPos,
              wp.course,
              wp.turnDirection,
              wp.distance ?? 2.0
            );
            features.push({
              type: 'Feature',
              geometry: { type: 'LineString', coordinates: ptGeom },
              properties: { type: 'procedure_turn', fixId: wp.fixId },
            });
          } catch {
            // Ignore procedure turn rendering errors
          }
        }
        allCoordinates.push(currentPos);
        break;

      default:
        // TF, DF, CF, IF, FA, CA, VA, etc. - straight line to waypoint
        allCoordinates.push(currentPos);
        break;
    }
  }

  // Main route line (insert as first feature)
  if (allCoordinates.length >= 2) {
    features.unshift({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: allCoordinates },
      properties: { type: 'route' },
    });
  }

  return { type: 'FeatureCollection', features };
}

function createWaypointGeoJSON(
  waypoints: RouteWaypoint[],
  routeType: RouteData['type']
): GeoJSON.FeatureCollection {
  // Include waypoints with coordinates, but track resolution status
  const waypointsWithCoords = waypoints.filter(
    (wp) => wp.latitude !== undefined && wp.longitude !== undefined
  );

  return {
    type: 'FeatureCollection',
    features: waypointsWithCoords.map((wp, idx) => {
      const altText = formatAltitudeConstraint(wp.altitude);
      const spdText = formatSpeedConstraint(wp.speed);
      const isResolved = wp.resolved !== false;

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
          // Resolution status for data-driven styling (unresolved = red)
          resolved: isResolved,
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
  if (!map.getStyle()) return;

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

  // Route casing (dark outline for contrast on satellite)
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
      'line-opacity': 0.8,
    },
  });

  // Main route line (solid, no dashes)
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
    },
  });

  // Waypoint symbols (unresolved waypoints shown in red)
  map.addLayer({
    id: WAYPOINT_LAYER_ID,
    type: 'circle',
    source: WAYPOINT_SOURCE_ID,
    paint: {
      'circle-color': [
        'case',
        ['get', 'resolved'],
        colors.waypoint,
        '#ff3333', // Red for unresolved waypoints
      ],
      'circle-radius': [
        'case',
        ['get', 'flyover'],
        LINE_WIDTH.waypointRadius + 1, // Slightly larger for flyover
        LINE_WIDTH.waypointRadius,
      ],
      'circle-stroke-width': LINE_WIDTH.waypointStroke,
      'circle-stroke-color': [
        'case',
        ['get', 'resolved'],
        colors.waypointStroke,
        '#ffffff', // White stroke for unresolved (contrast)
      ],
    },
  });

  // Waypoint ID labels - white text with thick black outline
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    layout: {
      'text-field': ['get', 'fullLabel'],
      'text-font': ['Open Sans Bold'],
      'text-size': 11,
      'text-offset': [0, -1.2],
      'text-anchor': 'bottom',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 2,
    },
  });

  // Altitude/Speed constraint labels (below waypoint) - white text with black outline
  map.addLayer({
    id: CONSTRAINT_LAYER_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    filter: ['any', ['get', 'hasAltitude'], ['get', 'hasSpeed']],
    layout: {
      'text-field': ['get', 'constraintLabel'],
      'text-font': ['Open Sans Bold'],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-line-height': 1.2,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': '#000000',
      'text-halo-width': 2,
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
  if (!map.getStyle()) return;

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
