import { describe, expect, it } from 'vitest';
import { LineLightingType, LineType, type LinearFeature } from '@/types/apt';
import { taxiwayLightLines, taxiwayLightPoints } from './taxiwayLights';

function feature(light: LineLightingType, coords: [number, number][]): LinearFeature {
  return {
    name: 'T',
    painted_line_type: LineType.SOLID_YELLOW,
    lighting_line_type: light,
    coordinates: coords,
  } as LinearFeature;
}

// ~1 km due east at the equator.
const KM_EAST: [number, number][] = [
  [0, 0],
  [0.009, 0],
];

describe('taxiwayLightPoints', () => {
  it('spaces green centreline fixtures 15 m apart', () => {
    const fc = taxiwayLightPoints([feature(LineLightingType.GREEN_BIDIRECTIONAL_LIGHTS, KM_EAST)]);
    expect(fc.features.length).toBeGreaterThanOrEqual(66);
    expect(fc.features.length).toBeLessThanOrEqual(68);
    expect(fc.features.every((f) => f.properties.color === 'green')).toBe(true);
  });

  it('skips amber hold bars, lead-on lights and unlit lines', () => {
    const fc = taxiwayLightPoints([
      feature(LineLightingType.AMBER_UNIDIRECTIONAL_PULSATING_LIGHTS, KM_EAST),
      feature(LineLightingType.AMBER_UNIDIRECTIONAL_LIGHTS, KM_EAST),
      feature(LineLightingType.ALTERNATING_AMBER_GREEN_BIDIRECTIONAL_LIGHTS, KM_EAST),
      feature(LineLightingType.ALTERNATING_AMBER_GREEN_UNIDIRECTIONAL_LIGHTS, KM_EAST),
      feature(LineLightingType.NONE, KM_EAST),
    ]);
    expect(fc.features).toHaveLength(0);
  });

  it('keeps red stop bars', () => {
    const fc = taxiwayLightPoints([
      feature(LineLightingType.RED_OMNIDIRECTIONAL_LIGHTS, [
        [0, 0],
        [0.0001, 0],
      ]),
    ]);
    expect(fc.features.length).toBeGreaterThan(0);
    expect(fc.features.every((f) => f.properties.color === 'red')).toBe(true);
  });

  it('keeps spacing across vertices instead of restarting at each one', () => {
    const bent = taxiwayLightPoints([
      feature(LineLightingType.GREEN_BIDIRECTIONAL_LIGHTS, [
        [0, 0],
        [0.00005, 0],
        [0.009, 0],
      ]),
    ]);
    const straight = taxiwayLightPoints([
      feature(LineLightingType.GREEN_BIDIRECTIONAL_LIGHTS, KM_EAST),
    ]);
    expect(Math.abs(bent.features.length - straight.features.length)).toBeLessThanOrEqual(1);
  });
});

describe('taxiwayLightLines', () => {
  it('returns one coloured line per lit feature', () => {
    const fc = taxiwayLightLines([
      feature(LineLightingType.BLUE_OMNIDIRECTIONAL_LIGHTS, KM_EAST),
      feature(LineLightingType.NONE, KM_EAST),
    ]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.properties.color).toBe('blue');
  });
});
