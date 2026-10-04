import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import {
  REFERENCE_SOURCE_ID,
  type ReferenceStyle,
  buildReferenceLayers,
  isReferenceLayerId,
} from './referenceLabels';

const style: ReferenceStyle = {
  glyphs: 'https://example.test/{fontstack}/{range}.pbf',
  sources: { carto: { type: 'vector', url: 'https://example.test/tiles.json' } },
  layers: [
    { id: 'background', type: 'background', paint: { 'background-color': '#000' } },
    { id: 'water', type: 'fill', source: 'carto', 'source-layer': 'water' },
    {
      id: 'boundary_country_inner',
      type: 'line',
      source: 'carto',
      'source-layer': 'boundary',
      paint: { 'line-color': '#333', 'line-width': 1 },
    },
    {
      id: 'place_country_1',
      type: 'symbol',
      source: 'carto',
      'source-layer': 'place',
      layout: { 'text-field': '{name_en}', 'text-size': 12 },
    },
    {
      id: 'place_city_dot_r7',
      type: 'symbol',
      source: 'carto',
      'source-layer': 'place',
      layout: { 'icon-image': 'circle-11' },
    },
    {
      id: 'poi_stadium',
      type: 'symbol',
      source: 'carto',
      'source-layer': 'poi',
      layout: { 'text-field': '{name}' },
    },
  ] as maplibregl.LayerSpecification[],
};

describe('buildReferenceLayers', () => {
  it('keeps borders and place names, drops fills, dots and points of interest', () => {
    const ids = buildReferenceLayers(style, 'en').map((l) => l.id);
    expect(ids).toEqual(['ref-boundary_country_inner', 'ref-place_country_1']);
    expect(ids.every(isReferenceLayerId)).toBe(true);
  });

  it('points every layer at the reference source and lightens borders', () => {
    const [border, label] = buildReferenceLayers(style, 'en') as (maplibregl.LayerSpecification & {
      source?: string;
    })[];
    expect(border?.source).toBe(REFERENCE_SOURCE_ID);
    expect(label?.source).toBe(REFERENCE_SOURCE_ID);
    expect((border as maplibregl.LineLayerSpecification).paint?.['line-color']).toMatch(/rgba/);
  });

  it('localizes the labels for a supported language and leaves English alone', () => {
    const [, label] = buildReferenceLayers(style, 'fr');
    expect((label as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:fr'],
      ['get', 'name_en'],
      ['get', 'name:latin'],
      ['get', 'name'],
    ]);
    const [, english] = buildReferenceLayers(style, 'en');
    expect((english as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toBe(
      '{name_en}'
    );
  });

  it('does not mutate the source style', () => {
    buildReferenceLayers(style, 'de');
    expect(style.layers[2]?.id).toBe('boundary_country_inner');
    expect((style.layers[3] as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toBe(
      '{name_en}'
    );
  });
});
