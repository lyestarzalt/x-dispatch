import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it, vi } from 'vitest';
import { drawPin } from './usePinDrop';

/**
 * A map whose style loads when the test says so. `addSource` and `addLayer`
 * throw before that, as MapLibre's `_checkLoaded` does (Sentry X-DISPATCH-4G).
 */
class LoadingMap {
  style: { _loaded: boolean } | null = { _loaded: false };
  sources = new Map<string, { setData: (d: unknown) => void; data: unknown }>();
  layers = new Set<string>();
  private listeners = new Map<string, Set<() => void>>();

  isStyleLoaded() {
    return this.style?._loaded === true;
  }
  hasImage() {
    return true;
  }
  getSource(id: string) {
    return this.sources.get(id);
  }
  addSource(id: string, spec: { data: unknown }) {
    if (!this.isStyleLoaded()) throw new Error('Style is not done loading.');
    const source = {
      data: spec.data,
      setData(d: unknown) {
        source.data = d;
      },
    };
    this.sources.set(id, source);
  }
  getLayer(id: string) {
    return this.layers.has(id) ? { id } : undefined;
  }
  addLayer(layer: { id: string }) {
    if (!this.isStyleLoaded()) throw new Error('Style is not done loading.');
    this.layers.add(layer.id);
  }
  once(event: string, listener: () => void) {
    const set = this.listeners.get(event) ?? new Set();
    set.add(listener);
    this.listeners.set(event, set);
  }
  off(event: string, listener: () => void) {
    this.listeners.get(event)?.delete(listener);
  }
  finishLoading() {
    this.style = { _loaded: true };
    const listeners = [...(this.listeners.get('styledata') ?? [])];
    this.listeners.set('styledata', new Set());
    for (const listener of listeners) listener();
  }
}

const asMap = (m: LoadingMap) => m as unknown as maplibregl.Map;

function pinFeature(map: LoadingMap) {
  const data = map.sources.get('pindrop-source')?.data as GeoJSON.FeatureCollection<GeoJSON.Point>;
  const [feature] = data.features;
  if (!feature) throw new Error('pin source has no feature');
  return feature;
}

describe('drawPin', () => {
  // X-DISPATCH-4G: the pin was dropped while the basemap was still loading.
  it('waits for the style instead of throwing, then draws the pin', async () => {
    const map = new LoadingMap();

    await expect(
      drawPin(asMap(map), () => ({ lng: -149.6, lat: -17.55, heading: 0 }))
    ).resolves.toBeUndefined();
    expect(map.sources.size).toBe(0);

    map.finishLoading();
    expect(map.layers.has('pindrop-layer')).toBe(true);
    expect(pinFeature(map).geometry.coordinates).toEqual([-149.6, -17.55]);
  });

  it('draws the pin where it is once the style loads, not where it was dropped', async () => {
    const map = new LoadingMap();
    const pin = { lng: 1, lat: 2, heading: 0 };
    await drawPin(asMap(map), () => pin);

    pin.lng = 3;
    pin.heading = 90;
    map.finishLoading();
    expect(pinFeature(map).geometry.coordinates).toEqual([3, 2]);
    expect(pinFeature(map).properties).toEqual({ heading: 90 });
  });

  it('draws nothing when the pin was cleared before the style loaded', async () => {
    const map = new LoadingMap();
    let pin: { lng: number; lat: number; heading: number } | null = { lng: 1, lat: 2, heading: 0 };
    await drawPin(asMap(map), () => pin);

    pin = null;
    map.finishLoading();
    expect(map.sources.size).toBe(0);
    expect(map.layers.size).toBe(0);
  });

  it('draws at once on a loaded style', async () => {
    const map = new LoadingMap();
    map.style = { _loaded: true };
    await drawPin(asMap(map), () => ({ lng: 5, lat: 6, heading: 0 }));
    expect(pinFeature(map).geometry.coordinates).toEqual([5, 6]);
  });

  it('draws nothing on a map removed while the image loaded', async () => {
    const map = new LoadingMap();
    map.style = null;
    const addSource = vi.spyOn(map, 'addSource');
    await expect(drawPin(asMap(map), () => ({ lng: 5, lat: 6, heading: 0 }))).resolves.toBe(
      undefined
    );
    expect(addSource).not.toHaveBeenCalled();
  });
});
