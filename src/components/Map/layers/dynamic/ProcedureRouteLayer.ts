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
import i18n from 'i18next';
import * as maplibregl from 'maplibre-gl';
import { buildUnitFormatters } from '@/hooks/useUnits';
import { procedureGeometry } from '@/lib/flightplan/builder/legGeometry';
import { magneticToTrue } from '@/lib/magvar';
import type { Degrees, NauticalMiles } from '@/lib/utils/geomath';
import { useSettingsStore } from '@/stores/settingsStore';
import type { AltitudeConstraint, ResolvedProcedureWaypoint } from '@/types/navigation';
import { zoomScaledTextSize } from '../labelSize';
import { safeAddGeoJSONSource } from '../types';
import {
  ROUTE_KIND_COLORS,
  ROUTE_LINE_OPACITY,
  ROUTE_LINE_WIDTH,
  procedureKind,
} from './routeStyle';

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
const MISSED_ROUTE_LAYER_ID = 'procedure-route-missed';
const ROUTE_SOURCE_ID = 'procedure-route-source';
const WAYPOINT_LAYER_ID = 'procedure-waypoints';
const WAYPOINT_SOURCE_ID = 'procedure-waypoints-source';
const LABEL_LAYER_ID = 'procedure-waypoint-labels';
const CONSTRAINT_LAYER_ID = 'procedure-constraints';
const LEG_LABEL_LAYER_ID = 'procedure-leg-labels';
const LEG_LABEL_SOURCE_ID = 'procedure-leg-labels-source';

// ============================================================================
// Chart Color Palette
// ============================================================================

/**
 * One shared style for every procedure type (SID/STAR/approach), not a color per type - matching
 * both the `--violet` "procedures" design token this app already uses for the flight-plan route
 * line (`FlightPlanLayer.ts`'s `COLORS.routeLine`) and how reference charting tools draw
 * procedures: a single consistent line style, not a different neon color per leg's role.
 */
const COLORS = {
  waypoint: '#717880', // --muted-foreground design token
  waypointStroke: '#000000',
  label: '#ffffff',
};

// Line widths
const LINE_WIDTH = {
  waypointRadius: 3.5, // Smaller waypoints
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
  const { path, missedPath, overlays } = procedureGeometry(waypoints);

  if (path.length < 2 && missedPath.length < 2) {
    return { type: 'FeatureCollection', features: [] };
  }

  if (path.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: path.map((p): [number, number] => [p.longitude, p.latitude]),
      },
      properties: { type: 'route' },
    });
  }

  if (missedPath.length >= 2) {
    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: missedPath.map((p): [number, number] => [p.longitude, p.latitude]),
      },
      properties: { type: 'route', missed: true },
    });
  }

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

/**
 * Distance + course labels at the midpoint of each leg between two resolved fixes, matching
 * reference charting tools (e.g. "9.9NM / 227°M" on the line itself, not just at the waypoints).
 * Each leg's own published distance/course are used, not the resolved-position geometry, so a
 * label still appears even where the drawn arc/intercept differs slightly from the straight line.
 */
export function createLegLabelGeoJSON(waypoints: RouteWaypoint[]): GeoJSON.FeatureCollection {
  const units = buildUnitFormatters(useSettingsStore.getState().map.units, i18n.t.bind(i18n));
  const features: GeoJSON.Feature[] = [];

  let prev: RouteWaypoint | null = null;
  for (const wp of waypoints) {
    if (wp.latitude === undefined || wp.longitude === undefined) continue;
    if (prev) {
      const parts: string[] = [];
      if (wp.distance !== null) parts.push(units.distance(wp.distance as NauticalMiles));
      if (wp.course !== null) {
        const courseTrue = magneticToTrue(wp.course as Degrees, wp.latitude, wp.longitude);
        parts.push(units.course(courseTrue, wp.latitude, wp.longitude));
      }
      if (parts.length > 0) {
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [(prev.longitude! + wp.longitude) / 2, (prev.latitude! + wp.latitude) / 2],
          },
          properties: { label: parts.join(' / ') },
        });
      }
    }
    prev = wp;
  }

  return { type: 'FeatureCollection', features };
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

  const lineColor = ROUTE_KIND_COLORS[procedureKind(route.type)];
  const routeGeoJSON = createRouteGeoJSON(resolvedWaypoints);
  const waypointGeoJSON = createWaypointGeoJSON(
    omitFlightPlanWaypoints(resolvedWaypoints, planFixes),
    route.type
  );
  const legLabelGeoJSON = createLegLabelGeoJSON(resolvedWaypoints);

  if (routeGeoJSON.features.length === 0) {
    return;
  }

  // Add sources
  safeAddGeoJSONSource(map, ROUTE_SOURCE_ID, routeGeoJSON);
  safeAddGeoJSONSource(map, WAYPOINT_SOURCE_ID, waypointGeoJSON);
  safeAddGeoJSONSource(map, LEG_LABEL_SOURCE_ID, legLabelGeoJSON);

  // Main route line (solid, no dashes)
  map.addLayer({
    id: ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['!=', ['get', 'missed'], true],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
    },
    paint: {
      'line-color': lineColor,
      'line-width': ROUTE_LINE_WIDTH,
      'line-opacity': ROUTE_LINE_OPACITY,
    },
  });

  // Missed-approach segment - dashed, dimmer, reference only.
  map.addLayer({
    id: MISSED_ROUTE_LAYER_ID,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    filter: ['==', ['get', 'missed'], true],
    layout: {
      'line-cap': 'butt',
      'line-join': 'round',
    },
    paint: {
      'line-color': lineColor,
      'line-width': ROUTE_LINE_WIDTH,
      'line-opacity': 0.5,
      'line-dasharray': [2, 2],
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
        COLORS.waypoint,
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
        COLORS.waypointStroke,
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

  // Distance/course labels at each leg's midpoint, muted so they read as reference, not a
  // competing label - matches how reference charting tools annotate each segment directly.
  map.addLayer({
    id: LEG_LABEL_LAYER_ID,
    type: 'symbol',
    source: LEG_LABEL_SOURCE_ID,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Regular'],
      'text-size': zoomScaledTextSize(9),
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': COLORS.waypoint,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });
}

export function removeProcedureRouteLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;

  const layers = [
    LEG_LABEL_LAYER_ID,
    CONSTRAINT_LAYER_ID,
    LABEL_LAYER_ID,
    WAYPOINT_LAYER_ID,
    ROUTE_LAYER_ID,
    MISSED_ROUTE_LAYER_ID,
  ];
  const sources = [WAYPOINT_SOURCE_ID, ROUTE_SOURCE_ID, LEG_LABEL_SOURCE_ID];

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
    LEG_LABEL_LAYER_ID,
    CONSTRAINT_LAYER_ID,
    LABEL_LAYER_ID,
    WAYPOINT_LAYER_ID,
    ROUTE_LAYER_ID,
    MISSED_ROUTE_LAYER_ID,
  ];

  for (const layerId of layers) {
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(layerId, 'visibility', visibility);
    }
  }
}

export const PROCEDURE_ROUTE_LAYER_IDS = [
  ROUTE_LAYER_ID,
  MISSED_ROUTE_LAYER_ID,
  WAYPOINT_LAYER_ID,
  LABEL_LAYER_ID,
  CONSTRAINT_LAYER_ID,
  LEG_LABEL_LAYER_ID,
];
