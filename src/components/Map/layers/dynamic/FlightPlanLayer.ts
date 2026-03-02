/**
 * Flight Plan Route Layer
 * Renders the flight plan with proper aviation symbols.
 */
import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import { svgToDataUrl } from '@/lib/utils/helpers';
import type { EnrichedFlightPlan, EnrichedWaypoint } from '@/types/fms';

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
  vor: '#2563EB', // Blue
  ndb: '#7C3AED', // Purple
  fix: '#374151', // Dark gray
  airport: '#1F2937', // Charcoal
  latlon: '#6B7280', // Gray
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

function createFixSymbol(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <polygon points="12,2 22,20 2,20" fill="${COLORS.fix}" stroke="#000" stroke-width="1"/>
  </svg>`;
}

function createAirportSymbol(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="10" fill="none" stroke="${COLORS.airport}" stroke-width="2"/>
    <circle cx="14" cy="14" r="4" fill="${COLORS.airport}"/>
    <line x1="14" y1="4" x2="14" y2="24" stroke="${COLORS.airport}" stroke-width="2"/>
    <line x1="4" y1="14" x2="24" y2="14" stroke="${COLORS.airport}" stroke-width="2"/>
  </svg>`;
}

function createVORSymbol(): string {
  // Hexagon
  const points = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    points.push(`${16 + 12 * Math.cos(angle)},${16 + 12 * Math.sin(angle)}`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <polygon points="${points.join(' ')}" fill="none" stroke="${COLORS.vor}" stroke-width="2"/>
    <circle cx="16" cy="16" r="3" fill="${COLORS.vor}"/>
  </svg>`;
}

function createNDBSymbol(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="10" fill="none" stroke="${COLORS.ndb}" stroke-width="2" stroke-dasharray="3,2"/>
    <circle cx="14" cy="14" r="4" fill="${COLORS.ndb}"/>
  </svg>`;
}

function createLatLonSymbol(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="6" fill="${COLORS.latlon}" stroke="#000" stroke-width="1"/>
  </svg>`;
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
function loadImage(map: maplibregl.Map, id: string, svg: string): void {
  if (map.hasImage(id)) return;
  const img = new Image();
  img.onload = () => {
    if (!map.hasImage(id)) {
      map.addImage(id, img, { sdf: false });
    }
  };
  img.src = svgToDataUrl(svg);
}

// ============================================================================
// Main Functions
// ============================================================================

export function addFlightPlanLayer(map: maplibregl.Map, fmsData: EnrichedFlightPlan): void {
  // Wait for style to load before adding layers
  if (!map.isStyleLoaded()) {
    map.once('style.load', () => {
      addFlightPlanLayer(map, fmsData);
    });
    return;
  }

  removeFlightPlanLayer(map);

  const waypoints = fmsData.waypoints;
  if (waypoints.length < 2) {
    return;
  }

  // Load images (async, will appear when ready)
  loadImage(map, 'fp-fix', createFixSymbol());
  loadImage(map, 'fp-airport', createAirportSymbol());
  loadImage(map, 'fp-vor', createVORSymbol());
  loadImage(map, 'fp-ndb', createNDBSymbol());
  loadImage(map, 'fp-latlon', createLatLonSymbol());
  loadImage(map, 'fp-tc', createBadgeSymbol('T/C', COLORS.clb));
  loadImage(map, 'fp-td', createBadgeSymbol('T/D', COLORS.dsc));

  // Route line GeoJSON — per-segment LineStrings with stage property
  const hasStages = waypoints.some((wp) => wp.stage);
  const routeFeatures: GeoJSON.Feature[] = [];

  if (hasStages) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      routeFeatures.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [waypoints[i].longitude, waypoints[i].latitude],
            [waypoints[i + 1].longitude, waypoints[i + 1].latitude],
          ],
        },
        properties: { stage: waypoints[i].stage || '' },
      });
    }
  } else {
    routeFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: waypoints.map((wp) => [wp.longitude, wp.latitude]),
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
      altitudeLabel: formatAltitude(wp.altitude),
      label: buildLabel(wp),
      symbolType: getSymbolId(wp),
    },
  }));

  // Detect T/C and T/D transitions
  if (hasStages) {
    for (let i = 0; i < waypoints.length - 1; i++) {
      const from = waypoints[i].stage;
      const to = waypoints[i + 1].stage;
      if (!from || !to || from === to) continue;

      const midLon = (waypoints[i].longitude + waypoints[i + 1].longitude) / 2;
      const midLat = (waypoints[i].latitude + waypoints[i + 1].latitude) / 2;

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
  map.addSource(SOURCE_ID, { type: 'geojson', data: routeGeoJSON });
  map.addSource(WAYPOINT_SOURCE_ID, { type: 'geojson', data: waypointGeoJSON });

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
      'text-size': 11,
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
      'text-size': 10,
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

    map.addSource(ALTERNATE_SOURCE_ID, { type: 'geojson', data: alternateGeoJSON });

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
        'text-size': 11,
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
  const layers = [
    ALTERNATE_LABEL_ID,
    ALTERNATE_LINE_ID,
    ALTITUDE_LABELS_ID,
    LABELS_ID,
    WAYPOINTS_ID,
    LINE_ID,
  ];
  const sources = [ALTERNATE_SOURCE_ID, WAYPOINT_SOURCE_ID, SOURCE_ID];

  const doRemove = () => {
    for (const id of layers) {
      if (map.getLayer(id)) map.removeLayer(id);
    }
    for (const id of sources) {
      if (map.getSource(id)) map.removeSource(id);
    }
  };

  // Defer removal if map is mid-render to prevent crash
  if (!map.isStyleLoaded()) {
    map.once('idle', doRemove);
  } else {
    doRemove();
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
