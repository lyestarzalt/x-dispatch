/**
 * Pilots of one online network on the map: an aircraft silhouette turned to the heading,
 * with the callsign and flight level beside it once zoomed in. One instance per network;
 * the two never show together.
 */
import * as maplibregl from 'maplibre-gl';
import { labelFont } from '@/lib/map/labelFonts';
import { METERS_PER_FOOT } from '@/lib/utils/units/constants';
import { useMapStore } from '@/stores/mapStore';
import type { NetworkId, NetworkPilot } from '@/types/networkTraffic';
import { moveLayersToTop, safeAddGeoJSONSource, setLayersVisibility } from '../types';
import { ensureAircraftIcons, ensureFallbackIcon, normalizeIcao } from './aircraftIcons';

/** Line and icon colour per network: the --success and --cat-blue tokens. */
export const NETWORK_COLORS: Record<NetworkId, string> = {
  vatsim: '#22c55e',
  ivao: '#60a5fa',
};

function ids(network: NetworkId) {
  return {
    source: `${network}-pilots-source`,
    icons: `${network}-pilots`,
    labels: `${network}-labels`,
  };
}

export function networkTrafficLayerIds(network: NetworkId): string[] {
  const { icons, labels } = ids(network);
  return [icons, labels];
}

function iconsOf(pilots: NetworkPilot[]): string[] {
  const codes = new Set<string>();
  for (const p of pilots) {
    if (p.flightPlan?.aircraft) codes.add(normalizeIcao(p.flightPlan.aircraft));
  }
  return [...codes];
}

export function createNetworkPilotGeoJSON(pilots: NetworkPilot[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: pilots.map((p) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude] },
      properties: {
        id: p.id,
        callsign: p.callsign,
        heading: p.headingDeg,
        acIcon: p.flightPlan?.aircraft ? normalizeIcao(p.flightPlan.aircraft) : '',
        onGround: p.onGround,
        // Metres above sea level the symbol is drawn at; it shows when the map is tilted (#136).
        heightM: p.onGround ? 0 : Math.max(0, p.altitudeFt * METERS_PER_FOOT),
        label: p.onGround
          ? p.callsign
          : `${p.callsign}\nFL${String(Math.max(0, Math.round(p.altitudeFt / 100))).padStart(3, '0')}`,
      },
    })),
  };
}

export async function addNetworkTrafficLayer(
  map: maplibregl.Map,
  network: NetworkId,
  pilots: NetworkPilot[]
): Promise<void> {
  if (!map.getStyle()) return;
  const { source, icons, labels } = ids(network);
  const color = NETWORK_COLORS[network];

  await ensureFallbackIcon(map);
  await ensureAircraftIcons(map, iconsOf(pilots));
  // The map may have gone away, or another caller may have mounted us, during the awaits.
  if (!map.getStyle()) return;
  safeAddGeoJSONSource(map, source, createNetworkPilotGeoJSON(pilots));
  if (map.getLayer(icons)) return;

  map.addLayer({
    id: icons,
    type: 'symbol',
    source,
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
      'symbol-height-offset': ['get', 'heightM'],
      'symbol-height-anchor': 'absolute',
    },
    paint: { 'icon-color': color },
  });

  map.addLayer({
    id: labels,
    type: 'symbol',
    source,
    minzoom: 5,
    layout: {
      'text-field': ['get', 'label'],
      'text-font': labelFont(map, 'semibold'),
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 9, 8, 10, 12, 11],
      'text-offset': [1.4, 0],
      'text-anchor': 'left',
      'text-justify': 'left',
      'text-line-height': 1.1,
      'text-optional': true,
      'symbol-height-offset': ['get', 'heightM'],
      'symbol-height-anchor': 'absolute',
    },
    paint: {
      'text-color': color,
      'text-halo-color': 'rgba(0, 0, 0, 0.85)',
      'text-halo-width': 1.2,
    },
  });
}

export async function updateNetworkTrafficLayer(
  map: maplibregl.Map,
  network: NetworkId,
  pilots: NetworkPilot[]
): Promise<void> {
  const { source } = ids(network);
  const existing = map.getSource(source) as maplibregl.GeoJSONSource | undefined;
  if (!existing) return addNetworkTrafficLayer(map, network, pilots);
  await ensureAircraftIcons(map, iconsOf(pilots));
  if (!map.getStyle()) return;
  existing.setData(createNetworkPilotGeoJSON(pilots));
}

export function removeNetworkTrafficLayer(map: maplibregl.Map, network: NetworkId): void {
  if (!map.getStyle()) return;
  const { source } = ids(network);
  for (const id of networkTrafficLayerIds(network)) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(source)) map.removeSource(source);
}

export function setNetworkTrafficLayerVisibility(
  map: maplibregl.Map,
  network: NetworkId,
  visible: boolean
): void {
  setLayersVisibility(map, networkTrafficLayerIds(network), visible);
}

export function bringNetworkTrafficLayersToTop(map: maplibregl.Map, network: NetworkId): void {
  moveLayersToTop(map, networkTrafficLayerIds(network));
}

const clickHandlerSetup = new WeakMap<maplibregl.Map, Set<NetworkId>>();

/** A click on a pilot selects it in the map store; the card and the route follow from there. */
export function setupNetworkTrafficClickHandler(map: maplibregl.Map, network: NetworkId): void {
  const done = clickHandlerSetup.get(map) ?? new Set<NetworkId>();
  if (done.has(network)) return;
  done.add(network);
  clickHandlerSetup.set(map, done);

  const { icons } = ids(network);
  map.on('click', icons, (e) => {
    const feature = e.features?.[0];
    const id = Number(feature?.properties.id);
    if (!Number.isFinite(id)) return;
    // Parked aircraft cover the airport dot; a click there opens the airport, not the pilot.
    if (
      feature?.properties.onGround &&
      map.getLayer('airports-hitbox') &&
      map.queryRenderedFeatures(e.point, { layers: ['airports-hitbox'] }).length > 0
    ) {
      return;
    }
    useMapStore.getState().setNetworkSelection({ kind: 'pilot', network, id });
  });
  map.on('mouseenter', icons, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', icons, () => {
    map.getCanvas().style.cursor = '';
  });
}
