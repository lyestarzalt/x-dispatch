import { describe, expect, it } from 'vitest';
import type { Navaid } from '@/types/navigation';
import { navaidLayer } from './NavaidLayer';

function navaid(overrides: Partial<Navaid>): Navaid {
  return {
    id: 'TST',
    name: 'TEST',
    type: 'VOR',
    latitude: 10,
    longitude: 20,
    elevation: 0,
    frequency: 11350,
    magneticVariation: 14,
    ...overrides,
  } as Navaid;
}

type HasCreateGeoJSON = { createGeoJSON(data: Navaid[]): GeoJSON.FeatureCollection };
const createGeoJSON = (data: Navaid[]) =>
  (navaidLayer as unknown as HasCreateGeoJSON).createGeoJSON(data);

describe('NavaidLayer rose rotation', () => {
  it('rotates VOR-family roses by the station declination so north points magnetic', () => {
    const fc = createGeoJSON([
      navaid({ type: 'VOR', magneticVariation: 14 }),
      navaid({ type: 'VORTAC', magneticVariation: -3.5 }),
      navaid({ type: 'VOR-DME', magneticVariation: 7 }),
    ]);
    expect(fc.features.map((f) => f.properties!.roseRotation)).toEqual([14, -3.5, 7]);
  });

  it('leaves non-rose symbols unrotated', () => {
    const fc = createGeoJSON([
      navaid({ type: 'NDB', magneticVariation: 14 }),
      navaid({ type: 'DME', magneticVariation: 14 }),
      navaid({ type: 'VOR', magneticVariation: undefined as unknown as number }),
    ]);
    expect(fc.features.map((f) => f.properties!.roseRotation)).toEqual([0, 0, 0]);
  });
});
