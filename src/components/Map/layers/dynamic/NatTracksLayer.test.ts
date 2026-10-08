import { describe, expect, it } from 'vitest';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';
import { natTracksGeoJSON } from './NatTracksLayer';

const track = (id: string, levels: number[]): OceanicTrackInfo => ({
  id,
  name: `NAT${id}`,
  eastbound: false,
  levels,
  validFrom: '',
  validTo: '',
  points: [
    { id: 'ENTRY', latitude: 54, longitude: -15 },
    { id: '5420N', latitude: 54, longitude: -20 },
    { id: 'EXIT', latitude: 53, longitude: -40 },
  ],
});

describe('natTracksGeoJSON', () => {
  it('draws one line per track, marks the chosen one and labels each with its letter and level band', () => {
    const { features } = natTracksGeoJSON([track('A', [340, 350, 360]), track('B', [])], 'NATB');
    expect(features).toHaveLength(2);
    expect(features[0]!.geometry).toEqual({
      type: 'LineString',
      coordinates: [
        [-15, 54],
        [-20, 54],
        [-40, 53],
      ],
    });
    expect(features[0]!.properties).toEqual({
      name: 'NATA',
      id: 'A',
      selected: false,
      label: 'A  FL340–FL360',
    });
    expect(features[1]!.properties).toEqual({ name: 'NATB', id: 'B', selected: true, label: 'B' });
  });
});
