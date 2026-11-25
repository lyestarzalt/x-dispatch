import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import {
  CHART_OVERLAY_LAYER_ID,
  CHART_OVERLAY_SOURCE_ID,
  setChartOverlayOpacity,
  showChartOverlay,
} from './ChartOverlayLayer';

function fakeMap() {
  const layers = new Map<string, { paint: Record<string, unknown> }>();
  const sources = new Map<string, unknown>();
  const map = {
    style: {},
    isStyleLoaded: () => true,
    getStyle: () => ({ layers: [] }),
    getLayer: (id: string) => layers.get(id),
    getSource: (id: string) => sources.get(id),
    addSource: vi.fn((id: string, spec: unknown) => sources.set(id, spec)),
    addLayer: vi.fn((layer: { id: string; paint: Record<string, unknown> }, _beforeId?: string) =>
      layers.set(layer.id, layer)
    ),
    removeLayer: (id: string) => layers.delete(id),
    removeSource: (id: string) => sources.delete(id),
    setPaintProperty: (id: string, key: string, value: unknown) => {
      layers.get(id)!.paint[key] = value;
    },
  };
  return { map: map as unknown as maplibregl.Map, layers, sources, raw: map };
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
});
