import { describe, expect, it } from 'vitest';
import type { Airspace } from '@/types/navigation';
import { airspaceLayer } from './AirspaceLayer';

function airspace(cls: string): Airspace {
  return {
    name: `${cls} TEST`,
    class: cls,
    coordinates: [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ],
    lowerLimit: 0,
    upperLimit: 10000,
  } as unknown as Airspace;
}

type HasCreateGeoJSON = { createGeoJSON(data: Airspace[]): GeoJSON.FeatureCollection };
const createGeoJSON = (data: Airspace[]) =>
  (airspaceLayer as unknown as HasCreateGeoJSON).createGeoJSON(data);

describe('AirspaceLayer class styling', () => {
  it('carries the per-class fill colour and opacity on each feature', () => {
    const [restricted, classE] = createGeoJSON([airspace('R'), airspace('E')]).features;
    expect(restricted!.properties!.fillColor).toBe('#ef4444');
    expect(restricted!.properties!.fillOpacity).toBe(0.2);
    expect(classE!.properties!.fillOpacity).toBe(0.08);
  });

  it('marks D/E/F/G as dashed and B/C/R as solid', () => {
    const fc = createGeoJSON([airspace('D'), airspace('E'), airspace('C'), airspace('R')]);
    expect(fc.features.map((f) => f.properties!.dashed)).toEqual([1, 1, 0, 0]);
  });
});
