import { describe, expect, it } from 'vitest';
import type { Runway, RunwayEnd } from '@/types/apt';
import { getRolloutEnd } from './rolloutEnd';

function makeEnd(name: string, lat: number, lon: number): RunwayEnd {
  // Only the fields the helper actually reads; the rest are filler so the
  // RunwayEnd type is satisfied without importing the whole apt parser.
  return {
    name,
    latitude: lat,
    longitude: lon,
    dthr_length: 0,
    overrun_length: 0,
    marking: 0 as RunwayEnd['marking'],
    lighting: 0 as RunwayEnd['lighting'],
    tdz_lighting: false,
    reil: 0 as RunwayEnd['reil'],
  };
}

function makeRunway(endA: RunwayEnd, endB: RunwayEnd): Runway {
  return {
    width: 45,
    surface_type: 1 as Runway['surface_type'],
    shoulder_surface_type: 0 as Runway['shoulder_surface_type'],
    shoulder_width: 0,
    smoothness: 0.25,
    centerline_lights: true,
    edge_lights: true,
    auto_distance_remaining_signs: false,
    ends: [endA, endB],
  };
}

describe('getRolloutEnd', () => {
  it('returns the opposite end of a parallel runway (18C → 36C)', () => {
    const e18C = makeEnd('18C', 39.05, -84.67); // KCVG-ish coords
    const e36C = makeEnd('36C', 39.07, -84.67);
    const runways = [makeRunway(e18C, e36C)];

    const result = getRolloutEnd(runways, '18C');
    expect(result).toBe(e36C);
  });

  it('works in the reverse direction (36C → 18C)', () => {
    const e18C = makeEnd('18C', 39.05, -84.67);
    const e36C = makeEnd('36C', 39.07, -84.67);
    const runways = [makeRunway(e18C, e36C)];

    expect(getRolloutEnd(runways, '36C')).toBe(e18C);
  });

  it('finds the right runway when multiple parallel runways exist', () => {
    // KCVG has 18C/36C, 18L/36L, 18R/36R — the helper must match by exact name.
    const e18L = makeEnd('18L', 39.04, -84.69);
    const e36L = makeEnd('36L', 39.06, -84.69);
    const e18C = makeEnd('18C', 39.05, -84.67);
    const e36C = makeEnd('36C', 39.07, -84.67);
    const e18R = makeEnd('18R', 39.04, -84.65);
    const e36R = makeEnd('36R', 39.06, -84.65);
    const runways = [makeRunway(e18L, e36L), makeRunway(e18C, e36C), makeRunway(e18R, e36R)];

    expect(getRolloutEnd(runways, '18C')).toBe(e36C);
    expect(getRolloutEnd(runways, '36L')).toBe(e18L);
    expect(getRolloutEnd(runways, '18R')).toBe(e36R);
  });

  it('returns null when the runway name does not exist', () => {
    const e18 = makeEnd('18', 0, 0);
    const e36 = makeEnd('36', 0, 0);
    const runways = [makeRunway(e18, e36)];

    expect(getRolloutEnd(runways, '27L')).toBeNull();
  });

  it('returns null when runways is undefined or empty', () => {
    expect(getRolloutEnd(undefined, '18C')).toBeNull();
    expect(getRolloutEnd([], '18C')).toBeNull();
  });
});
