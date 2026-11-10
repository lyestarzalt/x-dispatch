import { describe, expect, it } from 'vitest';
import type { GuidanceLeg, GuidanceRoute } from '@/lib/taxiGuidance';
import { destinationPoint, routeNameLines, routeTaxiwayNames } from './TaxiMapLabelsLayer';

function leg(name: string, isRunway = false): GuidanceLeg {
  return { name, isRunway, runways: [] };
}

function route(legs: GuidanceLeg[], overrides: Partial<GuidanceRoute> = {}): GuidanceRoute {
  return {
    icao: 'TEST',
    direction: 'departure',
    runway: '27',
    gateName: 'A1',
    source: 'planned',
    points: Array.from({ length: legs.length + 1 }, (_, i) => ({ lat: 0, lon: i })),
    legs,
    anchorNodeIds: [],
    nodeIds: [],
    ...overrides,
  };
}

describe('routeNameLines', () => {
  it('joins consecutive legs of the same taxiway into one line', () => {
    const fc = routeNameLines(route([leg('A'), leg('A'), leg('B')]));
    expect(fc.features.map((f) => f.properties?.name)).toEqual(['A', 'B']);
    expect((fc.features[0]!.geometry as GeoJSON.LineString).coordinates).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    expect((fc.features[1]!.geometry as GeoJSON.LineString).coordinates).toEqual([
      [2, 0],
      [3, 0],
    ]);
  });

  it('leaves runway and unnamed legs unlabelled', () => {
    const fc = routeNameLines(route([leg('A'), leg('09/27', true), leg(''), leg('A')]));
    expect(fc.features.map((f) => f.properties?.name)).toEqual(['A', 'A']);
  });
});

describe('routeTaxiwayNames', () => {
  it('lists each taxiway once, without runways', () => {
    expect(routeTaxiwayNames(route([leg('A'), leg('09/27', true), leg('B'), leg('A')]))).toEqual([
      'A',
      'B',
    ]);
  });
});

describe('destinationPoint', () => {
  it('marks the runway at the end of a departure', () => {
    const fc = destinationPoint(route([leg('A')]));
    expect(fc.features[0]?.properties?.name).toBe('27');
  });

  it('marks the stand at the end of an arrival', () => {
    const fc = destinationPoint(route([leg('A')], { direction: 'arrival', gateName: 'B12' }));
    expect(fc.features[0]?.properties?.name).toBe('B12');
    expect((fc.features[0]!.geometry as GeoJSON.Point).coordinates).toEqual([1, 0]);
  });

  it('is empty without a name', () => {
    expect(destinationPoint(route([leg('A')], { runway: null })).features).toEqual([]);
  });
});
