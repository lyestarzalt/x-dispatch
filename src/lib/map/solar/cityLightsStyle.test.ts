import { describe, expect, it } from 'vitest';
import {
  BASEMAP_OPACITY_BINDINGS,
  CITY_LIGHTS_BASEMAP_LAYER_IDS,
  basemapLightLayers,
  findOpenMapTilesSourceId,
  nightSidePlaces,
  placeLightLayers,
  quantizeNightFactor,
  scaledZoomStops,
} from './cityLightsStyle';
import { normalizeLongitude, subsolarPoint } from './solarPosition';

describe('nightSidePlaces', () => {
  it('keeps only places on the night side, each with its own night factor', () => {
    const time = Date.UTC(2026, 8, 19, 12, 0);
    const day = subsolarPoint(time);
    const night = { lat: -day.lat, lon: normalizeLongitude(day.lon + 180) };
    const collection = nightSidePlaces(
      [
        [day.lon, day.lat, 3],
        [night.lon, night.lat, 1],
      ],
      time
    );
    expect(collection.features).toHaveLength(1);
    const feature = collection.features[0]!;
    expect(feature.geometry.coordinates).toEqual([night.lon, night.lat]);
    expect(feature.properties).toEqual({ t: 1, n: 1 });
  });

  it('returns an empty collection when nothing is dark', () => {
    const time = Date.UTC(2026, 8, 19, 12, 0);
    const day = subsolarPoint(time);
    expect(nightSidePlaces([[day.lon, day.lat, 2]], time).features).toEqual([]);
  });
});

describe('quantizeNightFactor', () => {
  it('snaps to twentieths', () => {
    expect(quantizeNightFactor(0.531)).toBe(0.55);
    expect(quantizeNightFactor(0.01)).toBe(0);
    expect(quantizeNightFactor(1)).toBe(1);
  });
});

describe('scaledZoomStops', () => {
  it('folds the factor into the stop values and keeps zoom outermost', () => {
    const expr = scaledZoomStops(
      [
        [6, 0],
        [8, 0.2],
        [11, 0.3],
      ],
      0.5
    );
    expect(expr).toEqual(['interpolate', ['linear'], ['zoom'], 6, 0, 8, 0.1, 11, 0.15]);
  });
});

describe('findOpenMapTilesSourceId', () => {
  it('recognises the OpenFreeMap and CARTO vector sources', () => {
    expect(findOpenMapTilesSourceId({ openmaptiles: { type: 'vector' } })).toBe('openmaptiles');
    expect(findOpenMapTilesSourceId({ carto: { type: 'vector' }, ne2: { type: 'raster' } })).toBe(
      'carto'
    );
  });

  it('returns null for raster-only or unknown styles', () => {
    expect(findOpenMapTilesSourceId({ raster: { type: 'raster' } })).toBeNull();
    expect(findOpenMapTilesSourceId({ composite: { type: 'vector' } })).toBeNull();
    expect(findOpenMapTilesSourceId(undefined)).toBeNull();
  });
});

describe('layer specs', () => {
  it('binds every basemap layer to the source and scales its opacity by night', () => {
    const layers = basemapLightLayers('carto', 0.5);
    expect(layers.map((l) => l.id)).toEqual([...CITY_LIGHTS_BASEMAP_LAYER_IDS]);
    for (const layer of layers) {
      expect((layer as { source: string }).source).toBe('carto');
    }
    for (const binding of BASEMAP_OPACITY_BINDINGS) {
      const layer = layers.find((l) => l.id === binding.layerId)!;
      const paint = (layer as { paint: Record<string, unknown> }).paint;
      expect(paint[binding.property]).toEqual(scaledZoomStops(binding.stops, 0.5));
    }
  });

  it('fades the place points out where the basemap layers take over', () => {
    const [glow] = placeLightLayers();
    const paint = (glow as { paint: Record<string, unknown> }).paint;
    const opacity = paint['circle-opacity'] as unknown[];
    expect(opacity[0]).toBe('interpolate');
    expect(opacity[opacity.length - 1]).toBe(0);
    expect((glow as { maxzoom: number }).maxzoom).toBe(8);
  });
});
