import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { DEFAULT_REFERENCE_LABEL_SETTINGS } from './referenceLabelSettings';
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
      id: 'highway_name_other',
      type: 'symbol',
      source: 'carto',
      'source-layer': 'transportation_name',
      layout: { 'text-field': '{name}' },
    },
  ] as maplibregl.LayerSpecification[],
};

describe('buildReferenceLayers', () => {
  it('keeps borders, places and road names, drops fills and dot-only layers', () => {
    const ids = buildReferenceLayers(style, 'en').map((l) => l.id);
    expect(ids).toEqual([
      'ref-boundary_country_inner',
      'ref-place_country_1',
      'ref-place_town',
      'ref-highway_name_other',
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
    expect(town.paint).not.toHaveProperty('icon-color');
  });

  it('restyles labels as white text with a dark halo, bold for countries', () => {
    const layers = buildReferenceLayers(style, 'en') as maplibregl.SymbolLayerSpecification[];
    const country = layers.find((l) => l.id === 'ref-place_country_1')!;
    const town = layers.find((l) => l.id === 'ref-place_town')!;
    for (const label of [country, town]) {
      expect(label.paint?.['text-color']).toBe('rgb(255, 255, 255)');
      expect(label.paint?.['text-halo-color']).toMatch(/rgba\(0, 0, 0/);
      expect(label.paint?.['text-halo-width']).toBeGreaterThan(1);
    }
    expect(country.layout?.['text-font']).toEqual(['Noto Sans Bold']);
    expect(town.layout?.['text-font']).toBeUndefined();
  });

  it('does not mutate the source style', () => {
    buildReferenceLayers(style, 'de');
    expect(style.layers[2]?.id).toBe('boundary_country_inner');
    expect((style.layers[3] as maplibregl.SymbolLayerSpecification).layout?.['text-field']).toBe(
      '{name_en}'
    );
  });
});

describe('buildReferenceLayers settings', () => {
  const symbols = (settings = DEFAULT_REFERENCE_LABEL_SETTINGS) =>
    buildReferenceLayers(style, 'en', settings) as maplibregl.SymbolLayerSpecification[];

  it('drops the layers of a switched-off category', () => {
    const settings = {
      ...DEFAULT_REFERENCE_LABEL_SETTINGS,
      show: { ...DEFAULT_REFERENCE_LABEL_SETTINGS.show, countries: false, borders: false },
    };
    expect(symbols(settings).map((l) => l.id)).toEqual([
      'ref-place_town',
      'ref-highway_name_other',
    ]);
  });

  it('dims the text to the chosen brightness', () => {
    const town = symbols({ ...DEFAULT_REFERENCE_LABEL_SETTINGS, brightness: 0.6 }).find(
      (l) => l.id === 'ref-place_town'
    )!;
    expect(town.paint?.['text-color']).toBe('rgb(153, 153, 153)');
  });

  it('scales plain and zoom-driven text sizes', () => {
    const scaled = symbols({ ...DEFAULT_REFERENCE_LABEL_SETTINGS, sizeScale: 1.5 });
    const town = scaled.find((l) => l.id === 'ref-place_town')!;
    expect(town.layout?.['text-size']).toBe(16.5);
    const zoomed = buildReferenceLayers(
      {
        ...style,
        layers: [
          {
            id: 'place_city',
            type: 'symbol',
            source: 'carto',
            'source-layer': 'place',
            layout: {
              'text-field': '{name}',
              'text-size': ['interpolate', ['linear'], ['zoom'], 0, 9, 6, 12],
            },
          } as maplibregl.LayerSpecification,
        ],
      },
      'en',
      { ...DEFAULT_REFERENCE_LABEL_SETTINGS, sizeScale: 1.5 }
    )[0] as maplibregl.SymbolLayerSpecification;
    expect(zoomed.layout?.['text-size']).toEqual([
      'interpolate',
      ['linear'],
      ['zoom'],
      0,
      13.5,
      6,
      18,
    ]);
  });

  it('leaves sizes untouched at the default scale', () => {
    const town = symbols().find((l) => l.id === 'ref-place_town')!;
    expect(town.layout?.['text-size']).toBe(11);
  });
});
