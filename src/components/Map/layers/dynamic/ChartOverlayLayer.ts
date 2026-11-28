import type * as maplibregl from 'maplibre-gl';
import type { LonLat } from '@/types/geo';
import { safeRemove } from '../types';

/**
 * An FAA approach chart laid on the map at the position its PDF carries. The
 * chart is a canvas the window drew (`lib/chartOverlay/renderChart.ts`), so the source is a
 * MapLibre canvas source: not GeoJSON, with no `setData`, replaced whole for another chart.
 * It sits over the basemap and under everything the app draws, so the airport, navaids and
 * the route stay readable on top of it: the caller names the layer it goes under.
 */
export const CHART_OVERLAY_LAYER_ID = 'chart-overlay';
export const CHART_OVERLAY_SOURCE_ID = 'chart-overlay-source';

/**
 * At an opacity of exactly 1, with 3D terrain on, the relief shading showed through the chart,
 * so 100% looked weaker than 50%; at 0.99 it is solid (measured on KSEA ILS OR LOC RWY 16C,
 * 2026-11-24). Why MapLibre does this was not traced; the cap is what the measurement supports.
 */
const MAX_PAINT_OPACITY = 0.99;
const paintOpacity = (opacity: number) => Math.min(opacity, MAX_PAINT_OPACITY);

export function isChartOverlayOnMap(map: maplibregl.Map): boolean {
  return map.getLayer(CHART_OVERLAY_LAYER_ID) !== undefined;
}

/** Counts the charts shown on each map, so a removal held back until idle can tell it is stale. */
const shownCount = new WeakMap<maplibregl.Map, number>();

function takeOff(map: maplibregl.Map): void {
  if (map.getLayer(CHART_OVERLAY_LAYER_ID)) map.removeLayer(CHART_OVERLAY_LAYER_ID);
  if (map.getSource(CHART_OVERLAY_SOURCE_ID)) map.removeSource(CHART_OVERLAY_SOURCE_ID);
}

/**
 * Takes the chart off the map. While tiles load, `safeRemove` waits for `idle`; by then a
 * chart shown since is the one the pilot wants, so the held-back removal leaves it.
 */
export function removeChartOverlay(map: maplibregl.Map): void {
  const count = shownCount.get(map) ?? 0;
  safeRemove(map, () => {
    if ((shownCount.get(map) ?? 0) === count) takeOff(map);
  });
}

/**
 * Shows the chart, replacing the one on the map. Corners run clockwise from the top-left.
 * `beforeId` is the lowest layer that must stay above the chart; without one it goes on top.
 * Call it once the style takes layer updates (`runWhenStyleIsReady`): the old chart comes off
 * at once, since right after the camera moves the tiles are still loading and a removal held
 * back until `idle` would leave its source in the way of the new one.
 */
export function showChartOverlay(
  map: maplibregl.Map,
  canvas: HTMLCanvasElement,
  corners: [LonLat, LonLat, LonLat, LonLat],
  opacity: number,
  beforeId?: string
): void {
  shownCount.set(map, (shownCount.get(map) ?? 0) + 1);
  takeOff(map);
  map.addSource(CHART_OVERLAY_SOURCE_ID, {
    type: 'canvas',
    canvas,
    coordinates: corners,
    // The chart is drawn once; MapLibre must not re-read the canvas every frame.
    animate: false,
  });
  map.addLayer(
    {
      id: CHART_OVERLAY_LAYER_ID,
      type: 'raster',
      source: CHART_OVERLAY_SOURCE_ID,
      paint: { 'raster-opacity': paintOpacity(opacity), 'raster-fade-duration': 0 },
    },
    beforeId
  );
}

export function setChartOverlayOpacity(map: maplibregl.Map, opacity: number): void {
  if (map.getLayer(CHART_OVERLAY_LAYER_ID)) {
    map.setPaintProperty(CHART_OVERLAY_LAYER_ID, 'raster-opacity', paintOpacity(opacity));
  }
}
