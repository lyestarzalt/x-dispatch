import type { Map as MaplibreMap, StyleSpecification } from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { captureBasemapSnapshot, makePreserveCustomStyle } from './preserveCustomStyle';

/**
 * Build a minimal `StyleSpecification` with given source/layer ids.
 * Only enough to exercise `preserveCustomStyle`'s logic — we don't render.
 */
function makeStyle(opts: {
  sources?: Record<string, string>; // sourceId -> layer source-id reference
  layers: Array<{ id: string; type?: string; source?: string }>;
}): StyleSpecification {
  return {
    version: 8,
    sources: Object.fromEntries(
      Object.entries(opts.sources ?? {}).map(([id]) => [
        id,
        { type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}'] },
      ])
    ) as StyleSpecification['sources'],
    layers: opts.layers.map((l) => ({
      id: l.id,
      type: (l.type ?? 'background') as never,
      ...(l.source ? { source: l.source } : {}),
    })) as StyleSpecification['layers'],
  };
}

/**
 * Stand-in for a real MapLibre map. We only need a stable identity for the
 * WeakMap key and a `getStyle()` for `captureBasemapSnapshot`.
 */
function makeFakeMap(initial: StyleSpecification): MaplibreMap {
  return { getStyle: () => initial } as unknown as MaplibreMap;
}

describe('preserveCustomStyle', () => {
  it('drops previous-basemap layers and sources, keeps app-added customs', () => {
    const carto = makeStyle({
      sources: { carto: 'x' },
      layers: [
        { id: 'background', type: 'background' },
        { id: 'water', type: 'fill', source: 'carto' },
      ],
    });
    const map = makeFakeMap(carto);
    captureBasemapSnapshot(map);

    // Pretend the running style now has Carto's basemap + our custom layers.
    const previousWithCustoms: StyleSpecification = {
      ...carto,
      sources: {
        ...carto.sources,
        airports: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } as never,
      },
      layers: [
        ...carto.layers,
        { id: 'starfield', type: 'custom' as never },
        { id: 'airports', type: 'circle' as never, source: 'airports' },
      ],
    };
    const next = makeStyle({
      sources: { openmaptiles: 'x' },
      layers: [
        { id: 'background', type: 'background' },
        { id: 'roads', type: 'line', source: 'openmaptiles' },
      ],
    });

    const transform = makePreserveCustomStyle(map, ['terrain-hillshade'], 'starfield');
    const result = transform(previousWithCustoms, next);

    const layerIds = result.layers.map((l) => l.id);
    // Carto's leftover layers ('background', 'water') must NOT appear from previous —
    // 'background' appears only once (from next).
    expect(layerIds.filter((id) => id === 'background')).toHaveLength(1);
    // Our customs survived
    expect(layerIds).toContain('starfield');
    expect(layerIds).toContain('airports');
    // Next basemap layers landed
    expect(layerIds).toContain('roads');
    // Carto's water layer (referencing the dropped 'carto' source) is gone
    expect(layerIds).not.toContain('water');

    // Source set: next + customs, no leftover 'carto'
    expect(Object.keys(result.sources)).toContain('openmaptiles');
    expect(Object.keys(result.sources)).toContain('airports');
    expect(Object.keys(result.sources)).not.toContain('carto');
  });

  it('drops type:background layers from customs even when their id is unfamiliar (regression — leaked background covered satellite tiles → blank)', () => {
    // Snapshot was captured for an Esri raster basemap (just `raster`),
    // so a Carto background layer with id 'something-weird' would NOT be
    // caught by the id-based snapshot filter. The type-based filter below
    // catches it: a `type: 'background'` layer is always a basemap concept,
    // never a custom we add.
    const initial = makeStyle({
      sources: { raster: 'x' },
      layers: [{ id: 'raster', type: 'raster', source: 'raster' }],
    });
    const map = makeFakeMap(initial);
    captureBasemapSnapshot(map);

    const previous: StyleSpecification = {
      version: 8,
      sources: {
        raster: { type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}'], tileSize: 256 },
      } as StyleSpecification['sources'],
      layers: [
        { id: 'raster', type: 'raster' as never, source: 'raster' },
        // Leaked background — id won't match any snapshot, type marks it.
        { id: 'leaked-bg', type: 'background' as never },
      ] as StyleSpecification['layers'],
    };
    const next = makeStyle({
      sources: { raster: 'x' },
      layers: [{ id: 'raster', type: 'raster', source: 'raster' }],
    });

    const transform = makePreserveCustomStyle(map, ['terrain-hillshade'], 'starfield');
    const result = transform(previous, next);

    const layerIds = result.layers.map((l) => l.id);
    expect(layerIds).not.toContain('leaked-bg');
  });

  it('dedupes layer IDs even when a leftover slips through (regression for "duplicate layer id background" crash)', () => {
    // Simulate the corrupted state: previous has TWO `background` layers
    // (one from old basemap, one stray) and the WeakMap snapshot is empty
    // (so the snapshot fallback uses previous itself, which doesn't catch
    // the leak in this synthetic scenario). Real-world: HMR or migration
    // edge cases produced the same shape.
    const map = {} as unknown as MaplibreMap; // no snapshot captured
    const previous: StyleSpecification = {
      version: 8,
      sources: {},
      layers: [
        { id: 'background', type: 'background' },
        { id: 'starfield', type: 'background' },
        // Duplicate carried over via some buggy upstream path.
        { id: 'background', type: 'background' },
      ] as StyleSpecification['layers'],
    };
    const next = makeStyle({
      layers: [{ id: 'background', type: 'background' }],
    });

    const transform = makePreserveCustomStyle(map, ['terrain-hillshade'], 'starfield');
    const result = transform(previous, next);

    const backgroundCount = result.layers.filter((l) => l.id === 'background').length;
    expect(backgroundCount).toBe(1);
  });

  it('blacklist drops openmaptiles + carto sources even when the snapshot does not include them (state corrupted by older builds)', () => {
    // Simulate the corrupted scenario: the current basemap is Esri
    // satellite (snapshot.sources = ['raster']), but the running style has
    // `openmaptiles` and `carto` leaked in from a prior buggy transition.
    // The snapshot doesn't know about them, so the blacklist is what
    // protects us.
    const satellite = makeStyle({
      sources: { raster: 'x' },
      layers: [{ id: 'raster', type: 'raster', source: 'raster' }],
    });
    const map = makeFakeMap(satellite);
    captureBasemapSnapshot(map);

    const previous: StyleSpecification = {
      version: 8,
      sources: {
        raster: { type: 'raster', tiles: ['https://example.com/{z}/{x}/{y}'], tileSize: 256 },
        openmaptiles: { type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}'] },
        carto: { type: 'vector', tiles: ['https://example.com/{z}/{x}/{y}'] },
        airports: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } as never },
      } as StyleSpecification['sources'],
      layers: [
        { id: 'raster', type: 'raster' as never, source: 'raster' },
        { id: 'leaked-from-ofm', type: 'fill' as never, source: 'openmaptiles' },
        { id: 'leaked-from-carto', type: 'fill' as never, source: 'carto' },
        { id: 'airports', type: 'circle' as never, source: 'airports' },
      ] as StyleSpecification['layers'],
    };
    const next = makeStyle({
      sources: { 'next-source': 'x' },
      layers: [{ id: 'next-layer', type: 'fill', source: 'next-source' }],
    });

    const transform = makePreserveCustomStyle(map, ['terrain-hillshade'], 'starfield');
    const result = transform(previous, next);

    expect(Object.keys(result.sources)).not.toContain('openmaptiles');
    expect(Object.keys(result.sources)).not.toContain('carto');
    expect(Object.keys(result.sources)).toContain('airports');

    const layerIds = result.layers.map((l) => l.id);
    expect(layerIds).not.toContain('leaked-from-ofm');
    expect(layerIds).not.toContain('leaked-from-carto');
    expect(layerIds).toContain('airports');
  });
});
