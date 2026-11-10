/**
 * Labels for the taxi map under the detached flight strip, read like a car
 * navigation map: the route's taxiway names run along the green path, other
 * taxiways stay dim, runway ends and the route's destination are marked.
 */
import type * as maplibregl from 'maplibre-gl';
import { labelFont } from '@/lib/map/labelFonts';
import type { GuidanceRoute } from '@/lib/taxiGuidance';
import type { ParsedAirport } from '@/types/apt';
import { createTaxiwayNameGeoJSON } from '../../utils/geoJsonFactory';
import { safeAddGeoJSONSource } from '../types';

const OTHER_NAMES_SOURCE_ID = 'taxi-map-other-names';
const ROUTE_NAMES_SOURCE_ID = 'taxi-map-route-names';
const RUNWAY_ENDS_SOURCE_ID = 'taxi-map-runway-ends';
const DESTINATION_SOURCE_ID = 'taxi-map-destination';

const OTHER_NAMES_LAYER_ID = 'taxi-map-other-names';
const ROUTE_NAMES_LAYER_ID = 'taxi-map-route-names';
const RUNWAY_ENDS_LAYER_ID = 'taxi-map-runway-ends';
const DESTINATION_LAYER_ID = 'taxi-map-destination';

/** Bottom to top; MapLibre places the top layer's labels first. */
export const TAXI_MAP_LABEL_LAYER_IDS = [
  OTHER_NAMES_LAYER_ID,
  RUNWAY_ENDS_LAYER_ID,
  ROUTE_NAMES_LAYER_ID,
  DESTINATION_LAYER_ID,
];

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Taxiway sign colours: black on yellow for the route, red with white for runways. */
const SIGN_YELLOW = '#e6c619';
const SIGN_TEXT = '#1a1a2e';
const RUNWAY_RED = '#c81e1e';
const ROUTE_GREEN = '#22c55e';

/**
 * The route's taxiways as lines, one per run of legs with the same name, so each
 * name is written along the stretch it covers. Runway legs and unnamed legs carry
 * no label.
 */
export function routeNameLines(route: GuidanceRoute): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  let name = '';
  let coordinates: [number, number][] = [];
  const flush = () => {
    if (name && coordinates.length > 1) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates },
        properties: { name },
      });
    }
    coordinates = [];
  };
  route.legs.forEach((leg, i) => {
    const from = route.points[i];
    const to = route.points[i + 1];
    if (!from || !to) return;
    const legName = leg.isRunway ? '' : leg.name.trim();
    if (legName !== name) {
      flush();
      name = legName;
    }
    if (coordinates.length === 0) coordinates.push([from.lon, from.lat]);
    coordinates.push([to.lon, to.lat]);
  });
  flush();
  return { type: 'FeatureCollection', features };
}

/** Taxiway names on the route, so the dim layer leaves them to the route labels. */
export function routeTaxiwayNames(route: GuidanceRoute | null): string[] {
  if (!route) return [];
  return [...new Set(route.legs.filter((l) => !l.isRunway && l.name).map((l) => l.name.trim()))];
}

export function runwayEndPoints(airport: ParsedAirport): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: airport.runways.flatMap((runway) =>
      runway.ends.map((end) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [end.longitude, end.latitude] },
        properties: { name: end.name },
      }))
    ),
  };
}

/** The stand an arrival ends at, or the runway a departure ends at. */
export function destinationPoint(route: GuidanceRoute | null): GeoJSON.FeatureCollection {
  const end = route?.points[route.points.length - 1];
  const name = route?.direction === 'arrival' ? route.gateName : route?.runway;
  if (!end || !name) return EMPTY_FC;
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [end.lon, end.lat] },
        properties: { name },
      },
    ],
  };
}

export function addTaxiMapLabelLayers(map: maplibregl.Map): void {
  if (map.getSource(ROUTE_NAMES_SOURCE_ID)) return;
  for (const id of [
    OTHER_NAMES_SOURCE_ID,
    ROUTE_NAMES_SOURCE_ID,
    RUNWAY_ENDS_SOURCE_ID,
    DESTINATION_SOURCE_ID,
  ]) {
    safeAddGeoJSONSource(map, id, EMPTY_FC);
  }

  map.addLayer({
    id: OTHER_NAMES_LAYER_ID,
    type: 'symbol',
    source: OTHER_NAMES_SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': labelFont(map, 'bold'),
      'text-size': 11,
      'text-padding': 24,
    },
    paint: {
      'text-color': 'rgba(229, 231, 235, 0.55)',
      'text-halo-color': 'rgba(0, 0, 0, 0.6)',
      'text-halo-width': 1.5,
    },
  });

  map.addLayer({
    id: RUNWAY_ENDS_LAYER_ID,
    type: 'symbol',
    source: RUNWAY_ENDS_SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': labelFont(map, 'bold'),
      'text-size': 12,
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': RUNWAY_RED,
      'text-halo-width': 3,
    },
  });

  map.addLayer({
    id: ROUTE_NAMES_LAYER_ID,
    type: 'symbol',
    source: ROUTE_NAMES_SOURCE_ID,
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 220,
      'text-field': ['get', 'name'],
      'text-font': labelFont(map, 'bold'),
      'text-size': 13,
      'text-keep-upright': true,
      'text-max-angle': 40,
      'text-padding': 8,
    },
    paint: {
      'text-color': SIGN_TEXT,
      'text-halo-color': SIGN_YELLOW,
      'text-halo-width': 3,
    },
  });

  map.addLayer({
    id: DESTINATION_LAYER_ID,
    type: 'symbol',
    source: DESTINATION_SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-font': labelFont(map, 'bold'),
      'text-size': 13,
      'text-anchor': 'bottom',
      'text-offset': [0, -0.6],
      'text-allow-overlap': true,
    },
    paint: {
      'text-color': '#ffffff',
      'text-halo-color': ROUTE_GREEN,
      'text-halo-width': 3,
    },
  });
}

/** Labels that depend only on the airport: taxiway names and runway ends. */
export function setTaxiMapAirportLabels(map: maplibregl.Map, airport: ParsedAirport): void {
  const others = map.getSource(OTHER_NAMES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  others?.setData(airport.taxiNetwork ? createTaxiwayNameGeoJSON(airport.taxiNetwork) : EMPTY_FC);
  const ends = map.getSource(RUNWAY_ENDS_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  ends?.setData(runwayEndPoints(airport));
}

export function setTaxiMapRouteLabels(map: maplibregl.Map, route: GuidanceRoute | null): void {
  const names = map.getSource(ROUTE_NAMES_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  names?.setData(route ? routeNameLines(route) : EMPTY_FC);
  const destination = map.getSource(DESTINATION_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  destination?.setData(destinationPoint(route));
  if (map.getLayer(OTHER_NAMES_LAYER_ID)) {
    map.setFilter(OTHER_NAMES_LAYER_ID, [
      '!',
      ['in', ['get', 'name'], ['literal', routeTaxiwayNames(route)]],
    ]);
  }
}

/** Keeps the labels above the airport layers and the route line. */
export function bringTaxiMapLabelsToFront(map: maplibregl.Map): void {
  for (const id of TAXI_MAP_LABEL_LAYER_IDS) {
    if (map.getLayer(id)) map.moveLayer(id);
  }
}
