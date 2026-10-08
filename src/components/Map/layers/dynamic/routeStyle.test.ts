import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import { describe, expect, it } from 'vitest';
import {
  ROUTE_CASING_WIDTH,
  ROUTE_LINE_WIDTH,
  TRACK_WIDTH_FACTOR,
  widthByKindExpression,
} from './routeStyle';

function lineWidthErrors(width: unknown): string[] {
  return validateStyleMin({
    version: 8,
    sources: { s: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
    layers: [{ id: 'l', type: 'line', source: 's', paint: { 'line-width': width as never } }],
  }).map((e) => e.message);
}

describe('widthByKindExpression', () => {
  it('is a valid line-width expression (zoom interpolation must stay outermost)', () => {
    expect(lineWidthErrors(widthByKindExpression(ROUTE_LINE_WIDTH))).toEqual([]);
    expect(lineWidthErrors(widthByKindExpression(ROUTE_CASING_WIDTH))).toEqual([]);
  });

  it('keeps the zoom stops and widens only track legs', () => {
    const expr = widthByKindExpression(ROUTE_LINE_WIDTH) as unknown[];
    expect(expr.slice(0, 3)).toEqual(['interpolate', ['linear'], ['zoom']]);
    // Stops come in (zoom, value) pairs after the three header items.
    for (let i = 3; i < expr.length; i += 2) {
      const base = ROUTE_LINE_WIDTH[i + 1] as number;
      expect(expr[i]).toBe(ROUTE_LINE_WIDTH[i]);
      expect(expr[i + 1]).toEqual([
        'case',
        ['==', ['get', 'kind'], 'track'],
        base * TRACK_WIDTH_FACTOR,
        base,
      ]);
    }
  });
});
