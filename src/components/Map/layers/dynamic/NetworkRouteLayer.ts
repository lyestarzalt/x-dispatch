/**
 * The selected network pilot's track along its city pair: the part flown, from the departure
 * to the aircraft, drawn dim and dashed, and the part to go, from the aircraft to the arrival,
 * drawn solid. Both are great circles; the filed route itself is not resolved.
 */
import type * as maplibregl from 'maplibre-gl';
import { type LatLon, greatCirclePoints } from '@/lib/flightplan/builder/geometry';
import type { NetworkId, NetworkPilot } from '@/types/networkTraffic';
import { moveLayersToTop, safeAddGeoJSONSource } from '../types';
import { networkColor } from './NetworkTrafficLayer';

const SOURCE_ID = 'network-route-source';
const FLOWN_LAYER_ID = 'network-route-flown';
const REMAINING_LAYER_ID = 'network-route-remaining';
export const NETWORK_ROUTE_LAYER_IDS = [FLOWN_LAYER_ID, REMAINING_LAYER_ID];

/** Points per leg; enough that a transatlantic arc reads as a curve. */
const ARC_POINTS = 64;

function arc(a: LatLon, b: LatLon): GeoJSON.Position[] {
  return greatCirclePoints(a, b, ARC_POINTS).map((p) => [p.longitude, p.latitude]);
}

export function createNetworkRouteGeoJSON(
  pilot: NetworkPilot,
  departure: LatLon | null,
  arrival: LatLon | null
): GeoJSON.FeatureCollection {
  const here = { latitude: pilot.latitude, longitude: pilot.longitude };
  const features: GeoJSON.Feature[] = [];
  if (departure) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc(departure, here) },
      properties: { part: 'flown', network: pilot.network },
    });
  }
  if (arrival) {
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: arc(here, arrival) },
      properties: { part: 'remaining', network: pilot.network },
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Built when asked for: the traffic colour is the pilot's choice and can change. */
const colorByNetwork = (): maplibregl.ExpressionSpecification => [
  'match',
  ['get', 'network'],
  'ivao',
  networkColor('ivao'),
  networkColor('vatsim'),
];

/** Repaints the route already on the map after the traffic colour changed. */
export function applyNetworkRouteColors(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  for (const id of NETWORK_ROUTE_LAYER_IDS) {
    if (map.getLayer(id)) map.setPaintProperty(id, 'line-color', colorByNetwork());
  }
}

export function updateNetworkRouteLayer(
  map: maplibregl.Map,
  pilot: NetworkPilot,
  departure: LatLon | null,
  arrival: LatLon | null
): void {
  if (!map.getStyle()) return;
  safeAddGeoJSONSource(map, SOURCE_ID, createNetworkRouteGeoJSON(pilot, departure, arrival));
  if (map.getLayer(FLOWN_LAYER_ID)) return;

  map.addLayer({
    id: FLOWN_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['get', 'part'], 'flown'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colorByNetwork(),
      'line-width': 1.5,
      'line-opacity': 0.5,
      'line-dasharray': [2, 3],
    },
  });
  map.addLayer({
    id: REMAINING_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', ['get', 'part'], 'remaining'],
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': colorByNetwork(),
      'line-width': 2,
      'line-opacity': 0.9,
    },
  });
  // The pilot icons stay above the lines.
  for (const network of ['vatsim', 'ivao'] as NetworkId[]) {
    moveLayersToTop(map, [`${network}-pilots`, `${network}-labels`]);
  }
}

export function removeNetworkRouteLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  for (const id of NETWORK_ROUTE_LAYER_IDS) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function bringNetworkRouteLayersToTop(map: maplibregl.Map): void {
  moveLayersToTop(map, NETWORK_ROUTE_LAYER_IDS);
}
