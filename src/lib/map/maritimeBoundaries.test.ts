import type * as maplibregl from 'maplibre-gl';
import { describe, expect, it } from 'vitest';
import { landOnlyFilter } from './maritimeBoundaries';

describe('landOnlyFilter', () => {
  it('adds the land-only test to an expression filter', () => {
    const filter: maplibregl.FilterSpecification = ['==', ['get', 'admin_level'], 2];
    expect(landOnlyFilter(filter)).toEqual(['all', filter, ['!=', ['get', 'maritime'], 1]]);
  });

  it('uses the land-only test alone when there is no filter', () => {
    expect(landOnlyFilter(undefined)).toEqual(['!=', ['get', 'maritime'], 1]);
  });

  it('leaves a filter that already handles maritime borders alone', () => {
    const filter: maplibregl.FilterSpecification = ['!=', ['get', 'maritime'], 1];
    expect(landOnlyFilter(filter)).toBe(filter);
  });

  it('leaves legacy filters alone, they cannot mix with expressions', () => {
    const filter: maplibregl.FilterSpecification = ['==', 'admin_level', 2];
    expect(landOnlyFilter(filter)).toBe(filter);
  });
});
