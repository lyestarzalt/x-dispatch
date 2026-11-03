import type * as maplibregl from 'maplibre-gl';
import type { BasemapTheme } from '@/lib/map/basemapTheme';

/** Label layers of the around-airport nav overlays (navaids, ILS, airspaces). */
const NAV_LABEL_LAYER_IDS = [
  'nav-navaids-labels',
  'nav-ils-labels',
  'nav-airspaces-labels',
] as const;

/**
 * Label halo per basemap theme. The text itself keeps its per-feature colour;
 * only the halo swaps so coloured labels stay readable on light basemaps
 * instead of wearing a dark outline.
 */
const NAV_LABEL_HALOS: Record<BasemapTheme, string> = {
  dark: 'rgba(13, 17, 23, 0.9)',
  satellite: 'rgba(13, 17, 23, 0.9)',
  light: 'rgba(255, 255, 255, 0.9)',
  custom: 'rgba(255, 255, 255, 0.9)',
};

/**
 * Re-tint the nav overlay label halos for the basemap. Safe to call any time:
 * layers that are not on the map are skipped. Called after every nav layer
 * sync and from the `style.load` handler on basemap switches, alongside
 * `applyAirportTheme`.
 */
export function applyNavLayerTheme(map: maplibregl.Map, theme: BasemapTheme): void {
  const halo = NAV_LABEL_HALOS[theme];
  for (const layerId of NAV_LABEL_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue;
    map.setPaintProperty(layerId, 'text-halo-color', halo);
  }
}
