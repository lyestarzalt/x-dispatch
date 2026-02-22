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

export const FLIGHTPLAN_LAYER_IDS = [LINE_ID, WAYPOINTS_ID, LABELS_ID, ALTITUDE_LABELS_ID];

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
  removeFlightPlanLayer(map);

  const waypoints = fmsData.waypoints;
  if (waypoints.length < 2) return;

  // Load images (async, will appear when ready)
  loadImage(map, 'fp-fix', createFixSymbol());
  loadImage(map, 'fp-airport', createAirportSymbol());
  loadImage(map, 'fp-vor', createVORSymbol());
  loadImage(map, 'fp-ndb', createNDBSymbol());
  loadImage(map, 'fp-latlon', createLatLonSymbol());

  // Route line GeoJSON
  const routeGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: waypoints.map((wp) => [wp.longitude, wp.latitude]),
        },
        properties: {},
      },
    ],
  };

  // Waypoints GeoJSON
  const waypointGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: waypoints.map((wp, index) => ({
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
    })),
  };

  // Add sources
  map.addSource(SOURCE_ID, { type: 'geojson', data: routeGeoJSON });
  map.addSource(WAYPOINT_SOURCE_ID, { type: 'geojson', data: waypointGeoJSON });

  // Route line
  map.addLayer({
    id: LINE_ID,
    type: 'line',
    source: SOURCE_ID,
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': COLORS.routeLine,
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
}

export function removeFlightPlanLayer(map: maplibregl.Map): void {
  const layers = [ALTITUDE_LABELS_ID, LABELS_ID, WAYPOINTS_ID, LINE_ID];
  const sources = [WAYPOINT_SOURCE_ID, SOURCE_ID];

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
  fmsData.waypoints.forEach((wp) => bounds.extend([wp.longitude, wp.latitude]));
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 100, duration: 1500 });
}
