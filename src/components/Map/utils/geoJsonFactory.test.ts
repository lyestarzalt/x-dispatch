import { describe, expect, it } from 'vitest';
import type { LinearFeature, Runway } from '@/types/apt';
import { SurfaceType } from '@/types/apt';
import { createLinearFeatureGeoJSON, createRunwayGeoJSON } from './geoJsonFactory';

function landRunway(): Runway {
  const end = (name: string, latitude: number, longitude: number) => ({
    name,
    latitude,
    longitude,
    dthr_length: 0,
    overrun_length: 0,
    marking: 3,
    lighting: 0,
    tdz_lighting: false,
    reil: 0,
  });
  return {
    width: 45,
    surface_type: SurfaceType.ASPHALT,
    shoulder_surface_type: 0,
    shoulder_width: 0,
    smoothness: 0.25,
    centerline_lights: true,
    edge_lights: true,
    auto_distance_remaining_signs: false,
    ends: [end('09', 49.0, 2.5), end('27', 49.0, 2.55)],
  };
}

function feature(painted: number, lighting: number): LinearFeature {
  return {
    name: 'A',
    painted_line_type: painted,
    lighting_line_type: lighting,
    coordinates: [
      [2.5, 49],
      [2.501, 49.001],
    ],
  };
}

describe('createLinearFeatureGeoJSON', () => {
  it('keeps painted segments', () => {
    const fc = createLinearFeatureGeoJSON([feature(1, 0)]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toMatchObject({ lineType: 1, lightingType: 0 });
  });

  it('keeps unpainted segments that carry lights, so one source serves the glow layer', () => {
    const fc = createLinearFeatureGeoJSON([feature(0, 101)]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties).toMatchObject({ lineType: 0, lightingType: 101 });
  });

  it('drops segments with neither paint nor lights', () => {
    expect(createLinearFeatureGeoJSON([feature(0, 0)]).features).toHaveLength(0);
  });
});

describe('createRunwayGeoJSON', () => {
  it('includes water runways as water-surface polygons with their name', () => {
    const fc = createRunwayGeoJSON(
      [],
      [
        {
          width: 50,
          perimeter_buoys: true,
          ends: [
            { name: '09W', latitude: 62.51, longitude: -153.89 },
            { name: '27W', latitude: 62.508, longitude: -153.87 },
          ],
        },
      ]
    );
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0]!;
    expect(f.geometry.type).toBe('Polygon');
    expect(f.properties).toMatchObject({
      surface: SurfaceType.WATER_RUNWAY,
      name: '09W-27W',
      water: true,
    });
  });

  it('marks land runways as not water', () => {
    const fc = createRunwayGeoJSON([landRunway()], []);
    expect(fc.features[0]!.properties).toMatchObject({ water: false });
  });
});
