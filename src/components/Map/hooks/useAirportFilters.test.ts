import { describe, expect, it } from 'vitest';
import { DEFAULT_AIRPORT_FILTERS } from '@/stores/mapStore';
import { AIRPORT_FILTERABLE_LAYER_IDS, buildAirportLayerFilter } from './useAirportFilters';

describe('buildAirportLayerFilter', () => {
  it('filters every airport dot layer, halo and favourite star included', () => {
    expect(AIRPORT_FILTERABLE_LAYER_IDS).toEqual(
      expect.arrayContaining(['airports-halo', 'airports-favorite', 'airports', 'airport-labels'])
    );
  });

  it('keeps a layer on its own base filter when the user has not filtered anything', () => {
    expect(buildAirportLayerFilter('airports-favorite', DEFAULT_AIRPORT_FILTERS)).toEqual([
      '==',
      ['get', 'isFavorite'],
      1,
    ]);
  });

  it('keeps the base filter when a user condition is added', () => {
    const filter = buildAirportLayerFilter('airports-favorite', {
      ...DEFAULT_AIRPORT_FILTERS,
      showHeliport: false,
    });
    expect(filter).toEqual([
      'all',
      ['==', ['get', 'isFavorite'], 1],
      ['in', ['get', 'type'], ['literal', ['land', 'seaplane']]],
    ]);
  });

  it('hides every layer when no airport type is selected', () => {
    const none = {
      ...DEFAULT_AIRPORT_FILTERS,
      showLand: false,
      showSeaplane: false,
      showHeliport: false,
    };
    for (const id of AIRPORT_FILTERABLE_LAYER_IDS) {
      expect(buildAirportLayerFilter(id, none), id).toEqual([
        '==',
        ['get', 'icao'],
        '__never_match__',
      ]);
    }
  });
});
