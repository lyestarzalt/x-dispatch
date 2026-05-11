/**
 * Regression test for X-DISPATCH-S (`Source "nav-navaids-source" already exists`).
 *
 * Two concurrent `add()` calls race past the `await loadImages()` yield point:
 * both pass the `remove()` step (it removes nothing the second time), both
 * resume after the await, and the second `map.addSource()` throws because the
 * first already mounted it.
 *
 * The fix in NavLayerRenderer.add() is to re-check `map.getSource()` after the
 * await and fall back to `setData()` when a concurrent racer beat us to it.
 */
import maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { NavLayerRenderer } from './NavLayerRenderer';

type SourceDef = { type: 'geojson'; data: GeoJSON.FeatureCollection };

class MockMap {
  private sources = new Map<string, { def: SourceDef }>();
  private layers = new Map<string, maplibregl.LayerSpecification>();

  getStyle() {
    return { layers: [], sources: {} } as unknown as maplibregl.StyleSpecification;
  }
  isStyleLoaded() {
    return true;
  }

  getSource(id: string): maplibregl.Source | undefined {
    const entry = this.sources.get(id);
    if (!entry) return undefined;
    return {
      setData: (next: GeoJSON.FeatureCollection) => {
        entry.def.data = next;
      },
    } as unknown as maplibregl.Source;
  }
  addSource(id: string, def: SourceDef): void {
    if (this.sources.has(id)) throw new Error(`Source "${id}" already exists.`);
    this.sources.set(id, { def: { ...def, data: def.data } });
  }
  removeSource(id: string): void {
    this.sources.delete(id);
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }
  addLayer(spec: maplibregl.LayerSpecification): void {
    if (this.layers.has(spec.id)) throw new Error(`Layer "${spec.id}" already exists.`);
    this.layers.set(spec.id, spec);
  }
  removeLayer(id: string): void {
    this.layers.delete(id);
  }

  // For test inspection.
  _sourceData(id: string): GeoJSON.FeatureCollection | undefined {
    return this.sources.get(id)?.def.data;
  }
  _sourceCount(): number {
    return this.sources.size;
  }
  _layerCount(): number {
    return this.layers.size;
  }
}

type Item = { id: string };

class TestRenderer extends NavLayerRenderer<Item> {
  readonly layerId = 'test-layer';
  readonly sourceId = 'test-source';
  readonly additionalLayerIds: string[] = [];

  loadImagesGate: Promise<void> = Promise.resolve();
  loadImagesCalls = 0;

  protected async loadImages(_map: maplibregl.Map): Promise<boolean> {
    this.loadImagesCalls += 1;
    await this.loadImagesGate;
    return true;
  }

  protected createGeoJSON(data: Item[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: data.map((d) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: { id: d.id },
      })),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    map.addLayer({
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      paint: { 'circle-radius': 4 },
    });
  }
}

describe('NavLayerRenderer.add — concurrent calls', () => {
  it('does not throw when two add() calls race past the loadImages yield', async () => {
    const map = new MockMap() as unknown as maplibregl.Map;
    const renderer = new TestRenderer();
    let release: () => void = () => {};
    (renderer as TestRenderer).loadImagesGate = new Promise<void>((res) => {
      release = res;
    });

    const a = renderer.add(map, [{ id: 'a' }]);
    const b = renderer.add(map, [{ id: 'b' }]);

    release();

    await expect(Promise.all([a, b])).resolves.toBeDefined();
  });

  it('leaves exactly one source and one layer mounted after the race', async () => {
    const map = new MockMap();
    const renderer = new TestRenderer();
    let release: () => void = () => {};
    renderer.loadImagesGate = new Promise<void>((res) => {
      release = res;
    });

    const a = renderer.add(map as unknown as maplibregl.Map, [{ id: 'a' }]);
    const b = renderer.add(map as unknown as maplibregl.Map, [{ id: 'b' }]);
    release();
    await Promise.all([a, b]);

    expect(map._sourceCount()).toBe(1);
    expect(map._layerCount()).toBe(1);
  });

  it('preserves the second caller’s data (last write wins via setData)', async () => {
    const map = new MockMap();
    const renderer = new TestRenderer();
    let release: () => void = () => {};
    renderer.loadImagesGate = new Promise<void>((res) => {
      release = res;
    });

    const first = renderer.add(map as unknown as maplibregl.Map, [{ id: 'first' }]);
    const second = renderer.add(map as unknown as maplibregl.Map, [{ id: 'second' }]);
    release();
    await Promise.all([first, second]);

    const data = map._sourceData('test-source');
    expect(data?.features[0]?.properties?.id).toBe('second');
  });
});
