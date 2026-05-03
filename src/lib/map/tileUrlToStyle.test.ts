import { describe, expect, it } from 'vitest';
import {
  attributionForUrl,
  isRasterTileUrl,
  isVectorStyleUrl,
  resolveMapStyleArg,
  tileUrlToStyle,
  validateMapStyleUrl,
} from './tileUrlToStyle';

describe('isRasterTileUrl', () => {
  it('matches OSM-style tile URLs', () => {
    expect(isRasterTileUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png')).toBe(true);
  });

  it('matches tile URLs with {s} server-rotation placeholder', () => {
    expect(isRasterTileUrl('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')).toBe(true);
  });

  it('matches Esri-style {z}/{y}/{x} URLs', () => {
    expect(
      isRasterTileUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      )
    ).toBe(true);
  });

  it('returns false for MapLibre style URLs', () => {
    expect(isRasterTileUrl('https://tiles.openfreemap.org/styles/liberty')).toBe(false);
    expect(
      isRasterTileUrl('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    ).toBe(false);
  });

  it('returns false for empty / non-URL input', () => {
    expect(isRasterTileUrl('')).toBe(false);
    expect(isRasterTileUrl('not a url')).toBe(false);
  });

  it('does NOT match a vector-style URL whose path *contains* {x}/{y} as literal text', () => {
    // Anchored on /./ separators, so a placeholder buried in a query string
    // or template name without slashes between them won't false-positive.
    expect(isRasterTileUrl('https://example.com/styles/{z}-{x}-{y}/style.json')).toBe(false);
    expect(isRasterTileUrl('https://example.com/style.json?bbox={x},{y}')).toBe(false);
  });
});

describe('isVectorStyleUrl', () => {
  it('matches paths ending in style.json', () => {
    expect(
      isVectorStyleUrl('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    ).toBe(true);
    expect(isVectorStyleUrl('https://example.com/foo/style.json')).toBe(true);
  });

  it('matches OpenFreeMap-style /styles/<name> paths', () => {
    expect(isVectorStyleUrl('https://tiles.openfreemap.org/styles/liberty')).toBe(true);
  });

  it('rejects unrelated JSON endpoints', () => {
    // Earlier validation accepted any .json endpoint and any path containing /style.
    expect(isVectorStyleUrl('https://api.example.com/products.json')).toBe(false);
    expect(isVectorStyleUrl('https://example.com/styled-products/foo')).toBe(false);
    expect(isVectorStyleUrl('https://malicious.test/style-injector')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isVectorStyleUrl('not a url')).toBe(false);
    expect(isVectorStyleUrl('')).toBe(false);
  });
});

describe('tileUrlToStyle', () => {
  const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  it('returns a v8 style with one raster source and one raster layer', () => {
    const style = tileUrlToStyle(url);
    expect(style.version).toBe(8);
    expect(Object.keys(style.sources)).toEqual(['raster']);
    expect(style.layers).toHaveLength(1);
    expect(style.layers[0]?.type).toBe('raster');
  });

  it('puts the input URL in the source tiles array', () => {
    const style = tileUrlToStyle(url);
    const source = style.sources.raster as { tiles: string[] };
    expect(source.tiles).toEqual([url]);
  });

  it('includes default OpenStreetMap attribution', () => {
    const style = tileUrlToStyle(url);
    const source = style.sources.raster as { attribution: string };
    expect(source.attribution).toMatch(/OpenStreetMap/);
  });

  it('uses Esri attribution for arcgisonline tile URLs', () => {
    const esri =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const style = tileUrlToStyle(esri);
    const source = style.sources.raster as { attribution: string };
    expect(source.attribution).toMatch(/Esri/);
  });
});

describe('resolveMapStyleArg', () => {
  it('passes through MapLibre style URLs unchanged', () => {
    const url = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
    expect(resolveMapStyleArg(url)).toBe(url);
  });

  it('wraps {z}/{x}/{y} raster URLs into a synthetic style spec', () => {
    const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
    const result = resolveMapStyleArg(url);
    expect(typeof result).toBe('object');
    if (typeof result === 'string') throw new Error('expected style object');
    expect(result.version).toBe(8);
    const source = result.sources.raster as { tiles: string[] };
    expect(source.tiles).toEqual([url]);
  });

  it('wraps Esri-style {z}/{y}/{x} raster URLs (regression — MapLibre would 404 on JSON parse otherwise)', () => {
    const url =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    const result = resolveMapStyleArg(url);
    expect(typeof result).toBe('object');
    if (typeof result === 'string') throw new Error('expected style object');
    const source = result.sources.raster as { tiles: string[]; attribution: string };
    expect(source.tiles).toEqual([url]);
    expect(source.attribution).toMatch(/Esri/);
  });

  it('does not wrap a vector style URL that contains {x}/{y} literals in query (regression for tightened regex)', () => {
    const url = 'https://example.com/style.json?bbox={x},{y}';
    expect(resolveMapStyleArg(url)).toBe(url);
  });
});

describe('attributionForUrl', () => {
  it('returns Esri attribution for arcgisonline hosts', () => {
    expect(
      attributionForUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      )
    ).toMatch(/Esri/);
  });

  it('returns CARTO attribution for cartocdn hosts', () => {
    expect(
      attributionForUrl('https://basemaps.cartocdn.com/gl/positron-gl-style/style.json')
    ).toMatch(/CARTO/);
  });

  it('falls back to a generic credit for unknown hosts', () => {
    const result = attributionForUrl('https://tiles.example.com/{z}/{x}/{y}');
    expect(result).toMatch(/Map data contributors/);
  });
});

describe('validateMapStyleUrl', () => {
  it('accepts a vector style URL', () => {
    expect(
      validateMapStyleUrl('https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json')
    ).toBeNull();
  });

  it('accepts a raster {z}/{x}/{y} URL', () => {
    expect(validateMapStyleUrl('https://tile.openstreetmap.org/{z}/{x}/{y}.png')).toBeNull();
  });

  it('accepts a raster {z}/{y}/{x} URL (Esri)', () => {
    expect(
      validateMapStyleUrl(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      )
    ).toBeNull();
  });

  it('accepts http://localhost for self-hosted dev', () => {
    expect(validateMapStyleUrl('http://localhost:8080/style.json')).toBeNull();
  });

  it('rejects empty input', () => {
    expect(validateMapStyleUrl('')).toBe('required');
  });

  it('rejects malformed URLs', () => {
    expect(validateMapStyleUrl('not a url')).toBe('invalid-url');
  });

  it('rejects http:// for non-localhost hosts', () => {
    expect(validateMapStyleUrl('http://example.com/style.json')).toBe('insecure-protocol');
  });

  it('rejects URLs that are neither a vector style nor a raster pattern', () => {
    expect(validateMapStyleUrl('https://example.com/foo/bar')).toBe('unsupported-format');
    expect(validateMapStyleUrl('https://example.com/data.json')).toBe('unsupported-format');
  });

  it('rejects spurious /style substring matches that the previous loose check accepted', () => {
    // Earlier the picker accepted any url with /style or .json — too loose.
    expect(validateMapStyleUrl('https://example.com/styled-products/foo')).toBe(
      'unsupported-format'
    );
    expect(validateMapStyleUrl('https://malicious.test/style-injector')).toBe('unsupported-format');
  });
});
