import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import {
  CHART_OVERLAY_LAYER_ID,
  CHART_OVERLAY_SOURCE_ID,
  removeChartOverlay,
  setChartOverlayOpacity,
  showChartOverlay,
} from './ChartOverlayLayer';

/**
 * `tilesLoading` is the map just after the camera moved to a chart: the style is in
 * (`style._loaded`) but `isStyleLoaded()` stays false until the tiles arrive, so
 * `safeRemove` holds a removal back until `idle`.
 */
function fakeMap({ tilesLoading = false } = {}) {
  const layers = new Map<string, { paint: Record<string, unknown> }>();
  const sources = new Map<string, unknown>();
  const idle: Array<() => void> = [];
  const map = {
    style: { _loaded: true },
    isStyleLoaded: () => !tilesLoading,
    getStyle: () => ({ layers: [] }),
    once: (event: string, fn: () => void) => {
      if (event === 'idle') idle.push(fn);
    },
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    // MapLibre refuses a second source under the same id.
    addSource: vi.fn((id: string, spec: unknown) => {
      if (sources.has(id)) throw new Error(`Source "${id}" already exists.`);
      sources.set(id, spec);
    }),
    addLayer: vi.fn((layer: { id: string; paint: Record<string, unknown> }, _beforeId?: string) =>
      layers.set(layer.id, layer)
    ),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    setPaintProperty: (id: string, key: string, value: unknown) => {
      layers.get(id)!.paint[key] = value;
    },
  };
  const goIdle = () => idle.splice(0).forEach((fn) => fn());
  return { map: map as unknown as maplibregl.Map, layers, sources, raw: map, goIdle };
}

const canvas = {} as HTMLCanvasElement;
const corners: Parameters<typeof showChartOverlay>[2] = [
  [-122.97, 48.25],
  [-121.66, 48.25],
  [-121.67, 46.85],
  [-122.96, 46.85],
];

describe('ChartOverlayLayer', () => {
  it('lays the chart as a still canvas at its four corners', () => {
    const { map, sources } = fakeMap();
    showChartOverlay(map, canvas, corners, 0.7);
    expect(sources.get(CHART_OVERLAY_SOURCE_ID)).toEqual({
      type: 'canvas',
      canvas,
      coordinates: corners,
      animate: false,
    });
  });

  it('keeps full opacity just under 1, where MapLibre would let the relief show through', () => {
    const { map, layers } = fakeMap();
    showChartOverlay(map, canvas, corners, 1);
    expect(layers.get(CHART_OVERLAY_LAYER_ID)!.paint['raster-opacity']).toBe(0.99);
    setChartOverlayOpacity(map, 0.5);
    expect(layers.get(CHART_OVERLAY_LAYER_ID)!.paint['raster-opacity']).toBe(0.5);
    setChartOverlayOpacity(map, 1);
    expect(layers.get(CHART_OVERLAY_LAYER_ID)!.paint['raster-opacity']).toBe(0.99);
  });

  it('goes under the layer it is told to stay below', () => {
    const { map, raw } = fakeMap();
    showChartOverlay(map, canvas, corners, 0.7, 'airport-pavements');
    expect(raw.addLayer.mock.calls[0]![1]).toBe('airport-pavements');
  });

  it('replaces the chart on the map with the next one', () => {
    const { map, raw } = fakeMap();
    showChartOverlay(map, canvas, corners, 0.7);
    showChartOverlay(map, canvas, corners, 0.7);
    expect(raw.addSource).toHaveBeenCalledTimes(2);
  });

  // KJFK ILS OR LOC RWY 31R removed from the card and shown again from the airport dock, in
  // the packaged app: "Source "chart-overlay-source" already exists", and the card said the
  // chart could not be placed.
  it('replaces the chart while the map is still loading tiles', () => {
    const { map, raw, sources } = fakeMap({ tilesLoading: true });
    showChartOverlay(map, canvas, corners, 0.7);
    expect(() => showChartOverlay(map, canvas, corners, 0.7)).not.toThrow();
    expect(raw.addSource).toHaveBeenCalledTimes(2);
    expect(sources.has(CHART_OVERLAY_SOURCE_ID)).toBe(true);
  });

  it('a removal held back until idle leaves a chart shown after it on the map', () => {
    const { map, layers, sources, goIdle } = fakeMap({ tilesLoading: true });
    showChartOverlay(map, canvas, corners, 0.7);
    removeChartOverlay(map);
    showChartOverlay(map, canvas, corners, 0.7);
    goIdle();
    expect(layers.has(CHART_OVERLAY_LAYER_ID)).toBe(true);
    expect(sources.has(CHART_OVERLAY_SOURCE_ID)).toBe(true);
  });

  it('a removal held back until idle still takes the chart off', () => {
    const { map, layers, sources, goIdle } = fakeMap({ tilesLoading: true });
    showChartOverlay(map, canvas, corners, 0.7);
    removeChartOverlay(map);
    goIdle();
    expect(layers.has(CHART_OVERLAY_LAYER_ID)).toBe(false);
    expect(sources.has(CHART_OVERLAY_SOURCE_ID)).toBe(false);
  });
});
