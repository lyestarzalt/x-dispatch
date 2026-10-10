import { describe, expect, it } from 'vitest';
import type { LinearFeature } from '@/types/apt';
import { createLinearFeatureGeoJSON } from './geoJsonFactory';

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
