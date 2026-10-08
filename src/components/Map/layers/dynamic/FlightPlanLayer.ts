/**
 * Flight Plan Route Layer
 * Renders the flight plan with proper aviation symbols.
 */
import i18n from 'i18next';
import * as maplibregl from 'maplibre-gl';
import { buildUnitFormatters } from '@/hooks/useUnits';
import { bearingDeg, greatCircleNm } from '@/lib/flightplan/builder/geometry';
import { routeLineSegments } from '@/lib/flightplan/builder/routeLine';
import { NAT_TRACK_RE } from '@/lib/flightplan/builder/routeTokens';
import type { Degrees, NauticalMiles } from '@/lib/utils/geomath';
import { svgToDataUrl } from '@/lib/utils/helpers';
import { useSettingsStore } from '@/stores/settingsStore';
import type { EnrichedFlightPlan, EnrichedWaypoint } from '@/types/fms';
import { zoomScaledTextSize } from '../labelSize';
import { safeAddGeoJSONSource } from '../types';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_KIND_COLORS,
  ROUTE_LINE_OPACITY,
  ROUTE_LINE_WIDTH,
  kindColorExpression,
  legChipImageId,
  loadRouteLabelImages,
  waypointBadgeId,
  widthByKindExpression,
} from './routeStyle';

// Layer IDs
const SOURCE_ID = 'flightplan-route-source';
const WAYPOINT_SOURCE_ID = 'flightplan-waypoints-source';
const CASING_ID = 'flightplan-route-casing';
const LINE_ID = 'flightplan-route-line';
const MISSED_LINE_ID = 'flightplan-missed-approach-line';
const LEG_LABEL_SOURCE_ID = 'flightplan-leg-labels-source';
const AIRWAY_CHIPS_ID = 'flightplan-airway-chips';
const LEG_LABELS_ID = 'flightplan-leg-labels';
const PROCEDURE_NAME_SOURCE_ID = 'flightplan-procedure-names-source';
const PROCEDURE_NAMES_ID = 'flightplan-procedure-names';
const WAYPOINTS_ID = 'flightplan-waypoints';
const LABELS_ID = 'flightplan-labels';
const ALTITUDE_LABELS_ID = 'flightplan-altitude-labels';
const ALTERNATE_SOURCE_ID = 'flightplan-alternate-source';
const ALTERNATE_LINE_ID = 'flightplan-alternate-line';
const ALTERNATE_LABEL_ID = 'flightplan-alternate-label';

export const FLIGHTPLAN_LAYER_IDS = [
  CASING_ID,
  LINE_ID,
  MISSED_LINE_ID,
  AIRWAY_CHIPS_ID,
  LEG_LABELS_ID,
  PROCEDURE_NAMES_ID,
  WAYPOINTS_ID,
  LABELS_ID,
  ALTITUDE_LABELS_ID,
  ALTERNATE_LINE_ID,
  ALTERNATE_LABEL_ID,
];

// Professional aviation chart colors
const COLORS = {
  routeLine: ROUTE_KIND_COLORS.enroute,
  vor: '#60A5FA', // Blue
  ndb: '#C084FC', // Purple
  fix: '#E5E7EB', // Light gray, hollow on the dark basemap
  airport: '#F3F4F6', // Near white
  latlon: '#9CA3AF', // Gray
  labelText: '#FFFFFF', // White labels
  labelHalo: '#1F2937', // Dark halo
  altitudeText: '#94A3B8', // Muted slate
  // Phase colors
  clb: '#22C55E', // Green – climb
  crz: '#06B6D4', // Cyan – cruise
  dsc: '#F59E0B', // Amber – descent
  alternate: '#64748B', // Muted slate – alternate route
};

// ============================================================================
// SVG Symbols
// ============================================================================

// Chart-style symbols: hollow triangle waypoint, hexagon VOR, dotted circle NDB,
// all drawn at 2x for crisp edges on high-density displays and scaled down by the layer.
const SYMBOL_PX = 40;
const HALO = `stroke="${COLORS.labelHalo}" stroke-width="5" stroke-linejoin="round"`;

function symbolSvg(body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SYMBOL_PX}" height="${SYMBOL_PX}" viewBox="0 0 40 40">${body}</svg>`;
}

function createFixSymbol(): string {
  const tri = 'points="20,8 31,30 9,30"';
  return symbolSvg(
    `<polygon ${tri} fill="none" ${HALO}/>
     <polygon ${tri} fill="none" stroke="${COLORS.fix}" stroke-width="2.5" stroke-linejoin="round"/>`
  );
}

function createAirportSymbol(): string {
  return symbolSvg(
    `<circle cx="20" cy="20" r="12" fill="none" ${HALO}/>
     <circle cx="20" cy="20" r="12" fill="none" stroke="${COLORS.airport}" stroke-width="2.5"/>
     <rect x="9" y="17.5" width="22" height="5" rx="1" transform="rotate(-45 20 20)" fill="${COLORS.airport}"/>`
  );
}

function createVORSymbol(): string {
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    points.push(`${20 + 12 * Math.cos(angle)},${20 + 12 * Math.sin(angle)}`);
  }
  const hex = `points="${points.join(' ')}"`;
  return symbolSvg(
    `<polygon ${hex} fill="none" ${HALO}/>
     <polygon ${hex} fill="none" stroke="${COLORS.vor}" stroke-width="2.5" stroke-linejoin="round"/>
     <circle cx="20" cy="20" r="2.5" fill="${COLORS.vor}"/>`
  );
}

function createNDBSymbol(): string {
  return symbolSvg(
    `<circle cx="20" cy="20" r="11" fill="none" ${HALO}/>
     <circle cx="20" cy="20" r="11" fill="none" stroke="${COLORS.ndb}" stroke-width="2.5" stroke-dasharray="2.5,3"/>
     <circle cx="20" cy="20" r="5" fill="none" stroke="${COLORS.ndb}" stroke-width="2"/>
     <circle cx="20" cy="20" r="1.8" fill="${COLORS.ndb}"/>`
  );
}

function createLatLonSymbol(): string {
  return symbolSvg(
    `<circle cx="20" cy="20" r="6" fill="none" ${HALO}/>
     <circle cx="20" cy="20" r="6" fill="none" stroke="${COLORS.latlon}" stroke-width="2.5"/>`
  );
}

function createBadgeSymbol(text: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="20" viewBox="0 0 36 20">
    <rect x="1" y="1" width="34" height="18" rx="9" fill="#1E293B" stroke="${color}" stroke-width="1.5"/>
    <text x="18" y="14.5" text-anchor="middle" fill="${color}" font-family="sans-serif" font-size="10" font-weight="bold">${text}</text>
  </svg>`;
}

// ============================================================================
// Helpers
// ============================================================================

function formatAltitude(altitude: number): string {
  if (altitude === 0) return '';
  if (altitude >= 18000) return `FL${Math.round(altitude / 100)}`;
  return `${Math.round(altitude)}`;
}

function buildLabel(wp: EnrichedWaypoint): string {
  if (wp.frequency && wp.frequency > 0) {
    if (wp.type === 2) return `${wp.id}\n${wp.frequency}`;
    if (wp.type === 3) return `${wp.id}\n${wp.frequency.toFixed(2)}`;
  }
  return wp.id;
}

type ProcedurePathInfo = { via: string; kind?: 'sid' | 'star' | 'approach'; path: LatLon[] };
type LatLon = { latitude: number; longitude: number };

const mercatorY = (lat: number): number => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latFromMercatorY = (y: number): number =>
  ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/**
 * Where a leg's text goes and how it is turned: the midpoint of the leg as MapLibre draws it (a
 * straight line in Mercator) and the clockwise rotation that lays text along that line, flipped
 * where needed so it never reads upside down.
 */
export function legLabelPlacement(
  a: LatLon,
  b: LatLon
): { lon: number; lat: number; rotate: number } {
  const ya = mercatorY(a.latitude);
  const yb = mercatorY(b.latitude);
  // Both axes in radians of Web Mercator, so the angle is the one on screen.
  const dx = ((b.longitude - a.longitude) * Math.PI) / 180;
  const dy = yb - ya;
  // Screen angle of the line, clockwise from north, then rotated so text runs along it.
  const screenBearing = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360;
  let rotate = screenBearing - 90;
  if (screenBearing >= 180) rotate = screenBearing - 270; // west/southbound: keep the text upright
  return {
    lon: (a.longitude + b.longitude) / 2,
    lat: latFromMercatorY((ya + yb) / 2),
    rotate: ((rotate + 180) % 360) - 180,
  };
}

const NOT_AN_AIRWAY = new Set(['', 'DRCT', 'ADEP', 'ADES']);

/**
 * One label point per enroute leg at the leg's midpoint, turned to lie along it: the airway
 * name (shown zoomed out, once per run of legs on the same airway, on the longest of them) and
 * "46.0 NM 085°M" (shown zoomed in). Distance and course are the great-circle values between
 * the fixes. Procedure legs carry their procedure's name instead (see
 * `createProcedureNameGeoJSON`), and the leg from the approach runway to the airport is skipped
 * because no line is drawn there.
 */
export function createLegLabelGeoJSON(
  waypoints: EnrichedWaypoint[],
  procedurePaths?: ProcedurePathInfo[]
): GeoJSON.FeatureCollection {
  const units = buildUnitFormatters(useSettingsStore.getState().map.units, i18n.t.bind(i18n));
  const procedureVias = new Set((procedurePaths ?? []).map((p) => p.via));
  const flysApproach = (procedurePaths ?? []).some((p) => p.kind === 'approach');

  interface Leg {
    a: LatLon;
    b: LatLon;
    distanceNm: number;
    airway: string;
    label: string;
    showAirway: boolean;
  }
  const legs: Leg[] = [];
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1]!;
    const to = waypoints[i]!;
    if (to.via === 'ADES' && flysApproach) continue;
    if (procedureVias.has(to.via)) continue;
    const a = { latitude: from.latitude, longitude: from.longitude };
    const b = { latitude: to.latitude, longitude: to.longitude };
    const distanceNm = greatCircleNm(a, b);
    if (distanceNm < 0.05) continue;
    const label = [
      units.distance(distanceNm as NauticalMiles),
      units.course(bearingDeg(a, b) as Degrees, a.latitude, a.longitude),
    ].join(' ');
    legs.push({
      a,
      b,
      distanceNm,
      airway: NOT_AN_AIRWAY.has(to.via) ? '' : to.via,
      label,
      showAirway: false,
    });
  }
  // One airway chip per run of consecutive legs on the same airway, on the longest leg.
  for (let i = 0; i < legs.length;) {
    const airway = legs[i]!.airway;
    let j = i;
    let longest = i;
    while (j < legs.length && legs[j]!.airway === airway) {
      if (legs[j]!.distanceNm > legs[longest]!.distanceNm) longest = j;
      j++;
    }
    if (airway !== '') legs[longest]!.showAirway = true;
    i = j;
  }

  const features: GeoJSON.Feature[] = legs.map((leg) => {
    const { lon, lat, rotate } = legLabelPlacement(leg.a, leg.b);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        label: leg.label,
        airway: leg.airway,
        showAirway: leg.showAirway,
        rotate,
        chip: legChipImageId(NAT_TRACK_RE.test(leg.airway) ? 'track' : 'enroute'),
      },
    };
  });
  return { type: 'FeatureCollection', features };
}

/**
 * The procedure's name in a chip of its colour, one per SID/STAR/approach, laid along the
 * longest straight stretch of its drawn path (the midpoint and rotation of that segment).
 */
export function createProcedureNameGeoJSON(
  procedurePaths: ProcedurePathInfo[]
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const proc of procedurePaths) {
    if (proc.path.length < 2) continue;
    let best = 0;
    for (let i = 1; i < proc.path.length; i++) {
      if (
        greatCircleNm(proc.path[i - 1]!, proc.path[i]!) >
        greatCircleNm(proc.path[best]!, proc.path[best + 1]!)
      ) {
        best = i - 1;
      }
    }
    const kind = proc.kind ?? 'enroute';
    const { lon, lat, rotate } = legLabelPlacement(proc.path[best]!, proc.path[best + 1]!);
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: { name: proc.via, kind, rotate, chip: legChipImageId(kind) },
    });
  }
  return { type: 'FeatureCollection', features };
}

function getSymbolId(wp: EnrichedWaypoint): string {
  switch (wp.type) {
    case 1:
      return 'fp-airport';
    case 2:
      return 'fp-ndb';
    case 3:
      return 'fp-vor';
    case 28:
      return 'fp-latlon';
    default:
      return 'fp-fix';
  }
}

// Load a single image
function loadImage(map: maplibregl.Map, id: string, svg: string, pixelRatio = 1): void {
  if (map.hasImage(id)) return;
  const img = new Image();
  img.onload = () => {
    if (!map.hasImage(id)) {
      map.addImage(id, img, { sdf: false, pixelRatio });
    }
  };
  img.src = svgToDataUrl(svg);
}

// ============================================================================
// Main Functions
// ============================================================================

export function addFlightPlanLayer(map: maplibregl.Map, fmsData: EnrichedFlightPlan): void {
  // Style is always loaded by the time this is called from the map useEffect.
  // With transformStyle, layers survive basemap changes — no re-add needed.
  if (!map.getStyle()) return;

  const waypoints = fmsData.waypoints;
  if (waypoints.length < 2) {
    removeFlightPlanLayer(map);
    return;
  }

  // Load images (async, will appear when ready)
  loadImage(map, 'fp-fix', createFixSymbol(), 2);
  loadImage(map, 'fp-airport', createAirportSymbol(), 2);
  loadImage(map, 'fp-vor', createVORSymbol(), 2);
  loadImage(map, 'fp-ndb', createNDBSymbol(), 2);
  loadImage(map, 'fp-latlon', createLatLonSymbol(), 2);
  loadImage(map, 'fp-tc', createBadgeSymbol('T/C', COLORS.clb));
  loadImage(map, 'fp-td', createBadgeSymbol('T/D', COLORS.dsc));
  loadRouteLabelImages(map);

  // Route line GeoJSON — per-segment LineStrings with stage property
  const hasStages = waypoints.some((wp) => wp.stage);
  const routeFeatures: GeoJSON.Feature[] = [];

  if (hasStages) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i];
      const to = waypoints[i + 1];
      if (!from || !to) continue;
      routeFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [from.longitude, from.latitude],
            [to.longitude, to.latitude],
          ],
        },
        properties: { stage: from.stage || '' },
      });
    }
  } else {
    const segments = routeLineSegments(
      waypoints,
      fmsData.runwayEnds,
      fmsData.initialClimbNm,
      fmsData.procedurePaths
    );
    for (const seg of segments) {
      routeFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: seg.points.map((p) => [p.longitude, p.latitude]),
        },
        properties: { stage: '', kind: seg.kind, via: seg.via ?? '' },
      });
    }
  }

  // Missed-approach segments, kept out of the main (solid) route line and drawn dashed - they
  // aren't part of the filed route, just reference for what happens on a go-around.
  for (const proc of fmsData.procedurePaths ?? []) {
    if (!proc.missedPath || proc.missedPath.length < 2) continue;
    routeFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: proc.missedPath.map((p) => [p.longitude, p.latitude]),
      },
      properties: { stage: '', kind: 'missed', missed: true },
    });
  }

  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: routeFeatures,
  };

  // Waypoints GeoJSON — include T/C and T/D markers at phase transitions
  const waypointFeatures: GeoJSON.Feature[] = waypoints.map((wp, index) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [wp.longitude, wp.latitude],
    },
    properties: {
      id: wp.id,
      index,
      navType: wp.type,
      frequency: wp.frequency ?? 0,
      altitudeLabel: wp.constraintLabel ?? formatAltitude(wp.altitude),
      label: buildLabel(wp),
      badge: waypointBadgeId(wp.via, fmsData.procedurePaths),
      // Airports win collisions, then airway joins and navaids, then plain fixes.
      sortKey:
        wp.via === 'ADEP' || wp.via === 'ADES'
          ? 0
          : wp.via !== 'DRCT' || wp.type === 2 || wp.type === 3
            ? 1
            : 2,
      symbolType: getSymbolId(wp),
    },
  }));

  // Detect T/C and T/D transitions
  if (hasStages) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const wpFrom = waypoints[i];
      const wpTo = waypoints[i + 1];
      if (!wpFrom || !wpTo) continue;
      const from = wpFrom.stage;
      const to = wpTo.stage;
      if (!from || !to || from === to) continue;

      const midLon = (wpFrom.longitude + wpTo.longitude) / 2;
      const midLat = (wpFrom.latitude + wpTo.latitude) / 2;

      let badge: string | null = null;
      let badgeLabel: string | null = null;
      if (from === 'CLB' && to === 'CRZ') {
        badge = 'fp-tc';
        badgeLabel = 'T/C';
      } else if (from === 'CRZ' && to === 'DSC') {
        badge = 'fp-td';
        badgeLabel = 'T/D';
      }

      if (badge) {
        waypointFeatures.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [midLon, midLat] },
          properties: {
            id: badgeLabel,
            index: -1,
            altitudeLabel: '',
            label: '',
            symbolType: badge,
          },
        });
      }
    }
  }

  const waypointGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: waypointFeatures,
  };

  const dest = waypoints[waypoints.length - 1]!;
  const alt = fmsData.alternate;
  const alternateGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: alt
      ? [
          {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [dest.longitude, dest.latitude],
                [alt.longitude, alt.latitude],
              ],
            },
            properties: {},
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [alt.longitude, alt.latitude] },
            properties: { icao: alt.icao },
          },
        ]
      : [],
  };

  // Sources: created the first time, updated in place after that so an edited plan never
  // flashes off and on.
  safeAddGeoJSONSource(map, SOURCE_ID, routeGeoJSON);
  safeAddGeoJSONSource(map, WAYPOINT_SOURCE_ID, waypointGeoJSON);
  safeAddGeoJSONSource(
    map,
    LEG_LABEL_SOURCE_ID,
    createLegLabelGeoJSON(waypoints, fmsData.procedurePaths ?? [])
  );
  safeAddGeoJSONSource(
    map,
    PROCEDURE_NAME_SOURCE_ID,
    createProcedureNameGeoJSON(fmsData.procedurePaths ?? [])
  );
  safeAddGeoJSONSource(map, ALTERNATE_SOURCE_ID, alternateGeoJSON);
  if (map.getLayer(CASING_ID)) return;

  // Thin dark outline under the line so it reads over satellite imagery.
  map.addLayer({
    id: CASING_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['!=', ['get', 'missed'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': '#000000',
      'line-width': widthByKindExpression(ROUTE_CASING_WIDTH),
      'line-opacity': 0.45,
    },
  });

  // Route line: thick and translucent, one colour per leg kind (SID / STAR / approach / enroute,
  // wider and pink on an oceanic track), or per flight phase when the plan carries SimBrief stages.
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['!=', ['get', 'missed'], true],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': [
        'match',
        ['get', 'stage'],
        'CLB',
        COLORS.clb,
        'CRZ',
        COLORS.crz,
        'DSC',
        COLORS.dsc,
        kindColorExpression(),
      ],
      'line-width': widthByKindExpression(ROUTE_LINE_WIDTH),
      'line-opacity': ROUTE_LINE_OPACITY,
    },
  });

  // Missed-approach line — same geometry source, dashed and dimmer so it reads as reference-only.
  map.addLayer({
    id: MISSED_LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['get', 'missed'], true],
    layout: { 'line-cap': 'butt', 'line-join': 'round' },
    paint: {
      'line-color': ROUTE_KIND_COLORS.missed,
      'line-width': ROUTE_LINE_WIDTH,
      'line-opacity': 0.5,
      'line-dasharray': [2, 2],
    },
  });

  // Text embedded in the line: a chip in a darker shade of the line colour, sized to its text,
  // at the leg's midpoint and turned along the leg (one per leg - a line placement would repeat
  // per map tile). Chips collide with each other and with waypoint labels, so they thin out as
  // the map zooms out. Zoomed out only airway names show; zoomed in, distance and course.
  const chipLayout = {
    'text-font': ['Open Sans Semibold'],
    'text-size': zoomScaledTextSize(9),
    'text-anchor': 'center',
    'text-rotate': ['get', 'rotate'],
    'text-rotation-alignment': 'map',
    'text-allow-overlap': false,
    'text-ignore-placement': false,
    'icon-image': ['get', 'chip'],
    'icon-text-fit': 'both',
    'icon-text-fit-padding': [1, 4, 1, 4],
    'icon-rotate': ['get', 'rotate'],
    'icon-rotation-alignment': 'map',
    'icon-allow-overlap': false,
    'icon-ignore-placement': false,
  } satisfies maplibregl.SymbolLayerSpecification['layout'];
  map.addLayer({
    id: AIRWAY_CHIPS_ID,
    type: 'symbol',
    source: LEG_LABEL_SOURCE_ID,
    minzoom: 4,
    maxzoom: 8,
    filter: ['==', ['get', 'showAirway'], true],
    layout: { ...chipLayout, 'text-field': ['get', 'airway'] },
    paint: { 'text-color': COLORS.labelText },
  });
  map.addLayer({
    id: LEG_LABELS_ID,
    type: 'symbol',
    source: LEG_LABEL_SOURCE_ID,
    minzoom: 8,
    layout: { ...chipLayout, 'text-field': ['get', 'label'] },
    paint: { 'text-color': COLORS.labelText },
  });

  // Procedure names in a chip of their line's colour, on the longest straight stretch of the line.
  map.addLayer({
    id: PROCEDURE_NAMES_ID,
    type: 'symbol',
    source: PROCEDURE_NAME_SOURCE_ID,
    layout: {
      ...chipLayout,
      'text-field': ['get', 'name'],
      'text-font': ['Open Sans Bold'],
      'text-letter-spacing': 0.05,
    },
    paint: { 'text-color': COLORS.labelText },
  });

  // Waypoint symbols: always drawn, even where they pile up near the airports.
  map.addLayer({
    id: WAYPOINTS_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    layout: {
      'icon-image': ['get', 'symbolType'],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 8, 0.9, 12, 1.1],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
  });

  // Waypoint labels: a box beside the symbol (never on it or on the line), horizontal, in the
  // colour of what the fix belongs to. MapLibre picks the side that is free; a label that still
  // collides is hidden, but its symbol above stays. Airports win, then airway joins and navaids.
  map.addLayer({
    id: LABELS_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    filter: ['!=', ['get', 'label'], ''],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Bold'],
      'text-size': zoomScaledTextSize(10),
      'text-letter-spacing': 0.1,
      'text-variable-anchor': [
        'top-right',
        'right',
        'bottom-right',
        'top-left',
        'left',
        'bottom-left',
        'top',
        'bottom',
      ],
      'text-radial-offset': 1.1,
      'text-justify': 'auto',
      'symbol-sort-key': ['get', 'sortKey'],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'icon-image': ['get', 'badge'],
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [1, 4, 1, 4],
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
    },
    paint: {
      'text-color': COLORS.labelText,
    },
  });

  // Altitude labels
  map.addLayer({
    id: ALTITUDE_LABELS_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    filter: ['!=', ['get', 'altitudeLabel'], ''],
    minzoom: 7,
    layout: {
      'text-field': ['get', 'altitudeLabel'],
      'text-font': ['Open Sans Semibold'],
      'text-size': zoomScaledTextSize(9),
      'text-offset': [0, 1.4],
      'text-anchor': 'top',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': COLORS.altitudeText,
      'text-halo-color': COLORS.labelHalo,
      'text-halo-width': 1.5,
    },
  });

  // Alternate airport: a dashed line from the destination, empty when none is chosen.
  map.addLayer({
    id: ALTERNATE_LINE_ID,
    type: 'line',
    source: ALTERNATE_SOURCE_ID,
    filter: ['==', '$type', 'LineString'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.alternate,
      'line-width': 2,
      'line-dasharray': [4, 3],
      'line-opacity': 0.7,
    },
  });

  map.addLayer({
    id: ALTERNATE_LABEL_ID,
    type: 'symbol',
    source: ALTERNATE_SOURCE_ID,
    filter: ['==', '$type', 'Point'],
    layout: {
      'icon-image': 'fp-airport',
      'icon-size': 0.8,
      'text-field': ['get', 'icao'],
      'text-font': ['Open Sans Bold'],
      'text-size': zoomScaledTextSize(11),
      'text-offset': [0, -1.8],
      'text-anchor': 'bottom',
      'icon-allow-overlap': true,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': COLORS.alternate,
      'text-halo-color': COLORS.labelHalo,
      'text-halo-width': 2,
    },
  });
}

export function removeFlightPlanLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;

  const layers = [
    ALTERNATE_LABEL_ID,
    ALTERNATE_LINE_ID,
    ALTITUDE_LABELS_ID,
    LABELS_ID,
    WAYPOINTS_ID,
    LEG_LABELS_ID,
    AIRWAY_CHIPS_ID,
    PROCEDURE_NAMES_ID,
    LINE_ID,
    MISSED_LINE_ID,
    CASING_ID,
  ];
  const sources = [
    ALTERNATE_SOURCE_ID,
    WAYPOINT_SOURCE_ID,
    LEG_LABEL_SOURCE_ID,
    PROCEDURE_NAME_SOURCE_ID,
    SOURCE_ID,
  ];

  for (const id of layers) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  for (const id of sources) {
    if (map.getSource(id)) map.removeSource(id);
  }
}

export function setFlightPlanVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  for (const id of FLIGHTPLAN_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visibility);
  }
}

export function fitMapToFlightPlan(map: maplibregl.Map, fmsData: EnrichedFlightPlan): void {
  if (fmsData.waypoints.length === 0) return;
  const bounds = new maplibregl.LngLatBounds();
  fmsData.waypoints.forEach((wp) => {
    if (isFinite(wp.longitude) && isFinite(wp.latitude)) {
      bounds.extend([wp.longitude, wp.latitude]);
    }
  });
  if (
    fmsData.alternate &&
    isFinite(fmsData.alternate.longitude) &&
    isFinite(fmsData.alternate.latitude)
  ) {
    bounds.extend([fmsData.alternate.longitude, fmsData.alternate.latitude]);
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 100, duration: 1500 });
}
