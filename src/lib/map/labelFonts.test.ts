import { describe, expect, it } from 'vitest';
import { labelFontForStyle } from './labelFonts';

const symbol = (id: string, font: string[]) =>
  ({ id, type: 'symbol', source: 's', layout: { 'text-font': font } }) as const;

describe('labelFontForStyle', () => {
  it('uses the Noto family on OpenFreeMap, which has no semibold', () => {
    const style = {
      glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
      layers: [],
    };
    expect(labelFontForStyle(style, 'bold')).toEqual(['Noto Sans Bold']);
    expect(labelFontForStyle(style, 'semibold')).toEqual(['Noto Sans Bold']);
    expect(labelFontForStyle(style, 'regular')).toEqual(['Noto Sans Regular']);
  });

  it('uses the Open Sans family on Carto', () => {
    const style = {
      glyphs: 'https://tiles.basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf',
      layers: [],
    };
    expect(labelFontForStyle(style, 'bold')).toEqual(['Open Sans Bold']);
    expect(labelFontForStyle(style, 'semibold')).toEqual(['Open Sans Semibold']);
  });

  it('treats a raster basemap with no glyph URL yet as OpenFreeMap, which the reference labels bring', () => {
    expect(labelFontForStyle({ layers: [] }, 'bold')).toEqual(['Noto Sans Bold']);
    expect(labelFontForStyle(undefined, 'regular')).toEqual(['Noto Sans Regular']);
  });

  it('reads the families a custom style uses itself', () => {
    const style = {
      glyphs: 'https://fonts.example.test/{fontstack}/{range}.pbf',
      layers: [
        symbol('a', ['Roboto Regular']),
        symbol('b', ['Roboto Bold', 'Arial Unicode MS Bold']),
      ],
    };
    expect(labelFontForStyle(style, 'bold')).toEqual(['Roboto Bold']);
    expect(labelFontForStyle(style, 'semibold')).toEqual(['Roboto Bold']);
    expect(labelFontForStyle(style, 'regular')).toEqual(['Roboto Regular']);
  });

  it('falls back to the first family of a custom style, then to Noto', () => {
    const style = {
      glyphs: 'https://fonts.example.test/{fontstack}/{range}.pbf',
      layers: [symbol('a', ['Lato Black'])],
    };
    expect(labelFontForStyle(style, 'bold')).toEqual(['Lato Black']);
    expect(
      labelFontForStyle({ glyphs: 'https://fonts.example.test/x', layers: [] }, 'bold')
    ).toEqual(['Noto Sans Bold']);
  });
});
