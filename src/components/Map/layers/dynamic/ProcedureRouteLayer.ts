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
import * as maplibregl from 'maplibre-gl';
import { procedureGeometry } from '@/lib/flightplan/builder/legGeometry';
import type { AltitudeConstraint, ResolvedProcedureWaypoint } from '@/types/navigation';
import { zoomScaledTextSize } from '../labelSize';
import { safeAddGeoJSONSource } from '../types';

// ============================================================================
// Types
// ============================================================================

/** A procedure waypoint plus whether it's flown flyover (chart styling only). */
export type RouteWaypoint = ResolvedProcedureWaypoint & { flyover?: boolean };

export interface RouteData {
  type: 'SID' | 'STAR' | 'APPROACH' | 'ROUTE';
  name: string;
  waypoints: RouteWaypoint[];
  /** Transition altitude for the airport */
  transitionAlt?: number;
}

/** A fix the loaded flight plan already draws (symbol + label) on the map. */
export interface PlanFix {
  id: string;
  latitude: number;
  longitude: number;
}

/**
 * Two labels for one fix (≈ 0.005° ≈ 500 m). The flight plan layer and this
 * layer both label their waypoints at slightly different offsets, so a fix
 * shared by the plan and the selected procedure showed up twice, staggered.
 */
const SAME_FIX_DEG = 0.005;

/** The only shape {@link omitFlightPlanWaypoints} actually needs. */
interface FixPosition {
  fixId: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Drop procedure waypoints the flight plan layer already renders, so a fix
 * shared by both is drawn (symbol + label) once. The route line is built
 * from the full list; only the point features are filtered. Unresolved
 * waypoints are kept so they still surface in red.
 */
export function omitFlightPlanWaypoints<T extends FixPosition>(
  waypoints: T[],
  planFixes: PlanFix[]
): T[] {
  if (planFixes.length === 0) return waypoints;
  const byId = new Map<string, PlanFix[]>();
  for (const fix of planFixes) {
    const key = fix.id.toUpperCase();
    const list = byId.get(key);
    if (list) list.push(fix);
    else byId.set(key, [fix]);
  }
  return waypoints.filter((wp) => {
    if (wp.latitude === undefined || wp.longitude === undefined) return true;
    const candidates = byId.get(wp.fixId.toUpperCase());
    if (!candidates) return true;
    return !candidates.some(
      (fix) =>
        Math.abs(fix.latitude - wp.latitude!) <= SAME_FIX_DEG &&
        Math.abs(fix.longitude - wp.longitude!) <= SAME_FIX_DEG
    );
  });
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

  const formatAlt = (a: number): string => {
    if (alt.isFlightLevel || a >= 18000) {
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
 * Create route GeoJSON with path-terminator-aware geometry, via the same engine the flight-plan
 * line uses (`procedureGeometry`) - real RF/AF arcs, real DME/intercept crossings for fixless
 * legs (previously silently dropped here), and holding/procedure-turn overlays.
 */
function createRouteGeoJSON(waypoints: RouteWaypoint[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  const { path, overlays } = procedureGeometry(waypoints);

  if (path.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  features.push({
    type: 'Feature',
    geometry: {
      type: 'LineString',
      coordinates: path.map((p): [number, number] => [p.longitude, p.latitude]),
    },
    properties: { type: 'route' },
  });

  for (const overlay of overlays) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: overlay.points.map((p): [number, number] => [p.longitude, p.latitude]),
      },
      properties: {
        type: overlay.kind === 'holding' ? 'holding' : 'procedure_turn',
        fixId: overlay.fixId,
      },
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

export interface AddProcedureRouteOptions {
  /** Fixes the flight plan layer already renders; skipped here (default none). */
  planFixes?: PlanFix[];
}

export function addProcedureRouteLayer(
  map: maplibregl.Map,
  route: RouteData,
  waypointCoords?: Map<string, { lat: number; lon: number }>,
  { planFixes = [] }: AddProcedureRouteOptions = {}
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
  const waypointGeoJSON = createWaypointGeoJSON(
    omitFlightPlanWaypoints(resolvedWaypoints, planFixes),
    route.type
  );

  if (routeGeoJSON.features.length === 0) {
    return;
  }

  const colors = COLORS[route.type];

  // Add sources
  safeAddGeoJSONSource(map, ROUTE_SOURCE_ID, routeGeoJSON);
  safeAddGeoJSONSource(map, WAYPOINT_SOURCE_ID, waypointGeoJSON);

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
      'text-size': zoomScaledTextSize(11),
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
      'text-size': zoomScaledTextSize(10),
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
