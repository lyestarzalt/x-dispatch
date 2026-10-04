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
      id: 'place_town',
      type: 'symbol',
      source: 'carto',
      'source-layer': 'place',
      layout: { 'text-field': '{name}', 'icon-image': '', 'icon-size': 1, 'text-size': 11 },
      paint: { 'text-color': '#ccc', 'icon-color': '#fff' },
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
  it('keeps borders, places and points of interest, drops fills and dot-only layers', () => {
    const ids = buildReferenceLayers(style, 'en').map((l) => l.id);
    expect(ids).toEqual([
      'ref-boundary_country_inner',
      'ref-place_country_1',
      'ref-place_town',
      'ref-poi_stadium',
    ]);
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

  it('localizes the labels for a supported language and for English itself', () => {
    const [, label] = buildReferenceLayers(style, 'fr');
    expect((label as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:fr'],
      ['get', 'name:latin'],
      ['get', 'name_en'],
      ['get', 'name'],
    ]);
    const [, english] = buildReferenceLayers(style, 'en');
    expect((english as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toEqual([
      'coalesce',
      ['get', 'name:en'],
      ['get', 'name:latin'],
      ['get', 'name_en'],
      ['get', 'name'],
    ]);
  });

  it('keeps town labels but drops their icon properties', () => {
    const town = buildReferenceLayers(style, 'en').find(
      (l) => l.id === 'ref-place_town'
    ) as maplibregl.SymbolLayerSpecification;
    expect(town.layout).toEqual({ 'text-field': '{name}', 'text-size': 11 });
    expect(town.paint).toEqual({ 'text-color': '#ccc' });
  });

  it('does not mutate the source style', () => {
    buildReferenceLayers(style, 'de');
    expect(style.layers[2]?.id).toBe('boundary_country_inner');
    expect((style.layers[3] as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toBe(
      '{name_en}'
    );
  });
});
