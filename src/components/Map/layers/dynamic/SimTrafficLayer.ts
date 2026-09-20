import type * as maplibregl from 'maplibre-gl';
import type { TrafficTarget } from '@/types/traffic';
import { safeAddGeoJSONSource } from '../types';
import { ensureAircraftIcons, ensureFallbackIcon, normalizeIcao } from './aircraftIcons';

const SOURCE_ID = 'sim-traffic-source';
const ICON_LAYER_ID = 'sim-traffic';
const GLOW_LAYER_ID = 'sim-traffic-glow';
const LABEL_LAYER_ID = 'sim-traffic-labels';

const COLOR = '#f59e0b';
const COLOR_GLOW = '#b45309';

function toGeoJSON(targets: TrafficTarget[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: targets.map((t) => ({
      type: 'Feature' as const,
      id: t.slot,
      geometry: { type: 'Point' as const, coordinates: [t.longitude, t.latitude] },
      properties: {
        slot: t.slot,
        callsign: t.callsign,
        icaoType: t.icaoType,
        acIcon: t.icaoType ? normalizeIcao(t.icaoType) : '',
        heading: t.headingDeg,
        altitude: Math.round(t.altitudeFt),
        flightLevel: Math.round(t.altitudeFt / 100),
        groundspeed: Math.round(t.groundspeedKt),
      },
    })),
  };
}

/** Cheap per-frame update; no-op until the layer has been mounted. */
export function setSimTrafficData(map: maplibregl.Map, targets: TrafficTarget[]): boolean {
  if (!map.getStyle()) return false;
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
  if (!source) return false;
  source.setData(toGeoJSON(targets));
  return true;
}

/** Loads any new silhouette icons and mounts the layers on first call. */
export async function ensureSimTrafficLayer(
  map: maplibregl.Map,
  targets: TrafficTarget[]
): Promise<void> {
  if (!map.getStyle()) return;

  const icons = [...new Set(targets.map((t) => t.icaoType).filter(Boolean))].map(normalizeIcao);
  await ensureFallbackIcon(map);
  await ensureAircraftIcons(map, icons);
  if (!map.getStyle()) return;
  if (map.getSource(SOURCE_ID)) return;

  safeAddGeoJSONSource(map, SOURCE_ID, toGeoJSON(targets));
  map.addLayer({
    id: GLOW_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: {
      'circle-color': COLOR_GLOW,
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 3, 4, 8, 6, 12, 8],
      'circle-blur': 0.8,
      'circle-opacity': 0.4,
    },
  });
  map.addLayer({
    id: ICON_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'icon-image': [
        'coalesce',
        ['image', ['concat', 'ac-', ['get', 'acIcon']]],
        ['image', 'ac-fallback'],
      ],
      'icon-size': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 6, 0.8, 10, 1, 14, 1.2],
      'icon-rotate': ['get', 'heading'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
    },
    paint: { 'icon-color': COLOR },
  });
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 5,
    layout: {
      'text-field': [
        'format',
        ['get', 'callsign'],
        { 'font-scale': 1 },
        '\n',
        {},
        ['concat', 'FL', ['to-string', ['get', 'flightLevel']]],
        { 'font-scale': 0.8 },
      ],
      'text-font': ['Open Sans Semibold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 10, 12, 11],
      'text-offset': [1.5, 0],
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-optional': true,
    },
    paint: {
      'text-color': COLOR,
      'text-halo-color': 'rgba(0, 0, 0, 0.9)',
      'text-halo-width': 1.5,
    },
  });
}

export function removeSimTrafficLayer(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  for (const id of [LABEL_LAYER_ID, ICON_LAYER_ID, GLOW_LAYER_ID]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}
