/**
 * Flight Plan Route Layer
 * Renders the flight plan with proper aviation symbols.
 */
import * as maplibregl from 'maplibre-gl';
import { routeLinePoints } from '@/lib/flightplan/builder/routeLine';
import { svgToDataUrl } from '@/lib/utils/helpers';
import type { EnrichedFlightPlan, EnrichedWaypoint } from '@/types/fms';
import { zoomScaledTextSize } from '../labelSize';
import { safeAddGeoJSONSource } from '../types';

// Layer IDs
const SOURCE_ID = 'flightplan-route-source';
const WAYPOINT_SOURCE_ID = 'flightplan-waypoints-source';
const LINE_ID = 'flightplan-route-line';
const WAYPOINTS_ID = 'flightplan-waypoints';
const LABELS_ID = 'flightplan-labels';
const ALTITUDE_LABELS_ID = 'flightplan-altitude-labels';
const ALTERNATE_SOURCE_ID = 'flightplan-alternate-source';
const ALTERNATE_LINE_ID = 'flightplan-alternate-line';
const ALTERNATE_LABEL_ID = 'flightplan-alternate-label';

export const FLIGHTPLAN_LAYER_IDS = [
  LINE_ID,
  WAYPOINTS_ID,
  LABELS_ID,
  ALTITUDE_LABELS_ID,
  ALTERNATE_LINE_ID,
  ALTERNATE_LABEL_ID,
];

// Professional aviation chart colors
const COLORS = {
  routeLine: '#8B5CF6', // Deep violet (like Jeppesen charts)
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

  removeFlightPlanLayer(map);

  const waypoints = fmsData.waypoints;
  if (waypoints.length < 2) {
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
    routeFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: routeLinePoints(
          waypoints,
          fmsData.runwayEnds,
          fmsData.firstTurn,
          fmsData.initialClimbNm
        ).map((p) => [p.longitude, p.latitude]),
      },
      properties: { stage: '' },
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

  // Add sources
  safeAddGeoJSONSource(map, SOURCE_ID, routeGeoJSON);
  safeAddGeoJSONSource(map, WAYPOINT_SOURCE_ID, waypointGeoJSON);

  // Route line — phase-colored via match expression
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
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
        COLORS.routeLine,
      ],
      'line-width': ['interpolate', ['linear'], ['zoom'], 4, 3, 8, 5, 12, 6],
      'line-opacity': 0.9,
    },
  });

  // Waypoint symbols
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

  // Waypoint labels - clean white text
  map.addLayer({
    id: LABELS_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    filter: ['!=', ['get', 'label'], ''],
    layout: {
      'text-field': ['get', 'label'],
      'text-font': ['Open Sans Bold'],
      'text-size': zoomScaledTextSize(11),
      'text-offset': [0, -1.8],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': COLORS.labelText,
      'text-halo-color': COLORS.labelHalo,
      'text-halo-width': 2,
    },
  });

  // Altitude labels
  map.addLayer({
    id: ALTITUDE_LABELS_ID,
    type: 'symbol',
    source: WAYPOINT_SOURCE_ID,
    filter: ['!=', ['get', 'altitudeLabel'], ''],
    layout: {
      'text-field': ['get', 'altitudeLabel'],
      'text-font': ['Open Sans Semibold'],
      'text-size': zoomScaledTextSize(10),
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
    },
    paint: {
      'text-color': COLORS.altitudeText,
      'text-halo-color': COLORS.labelHalo,
      'text-halo-width': 1.5,
    },
  });

  // Alternate airport — dashed line from destination
  if (fmsData.alternate) {
    const dest = waypoints[waypoints.length - 1];
    if (!dest) return;
    const alt = fmsData.alternate;

    const alternateGeoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: [
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
      ],
    };

    safeAddGeoJSONSource(map, ALTERNATE_SOURCE_ID, alternateGeoJSON);

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
}

export function removeFlightPlanLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;

  const layers = [
    ALTERNATE_LABEL_ID,
    ALTERNATE_LINE_ID,
    ALTITUDE_LABELS_ID,
    LABELS_ID,
    WAYPOINTS_ID,
    LINE_ID,
  ];
  const sources = [ALTERNATE_SOURCE_ID, WAYPOINT_SOURCE_ID, SOURCE_ID];

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
