import { describe, expect, it } from 'vitest';
import type { ParsedAirport, Runway, RunwayEnd } from '@/types/apt';
import { airportBoundsHaveArea, getAirportBounds } from './airportBounds';

function makeEnd(name: string, lat: number, lon: number): RunwayEnd {
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

function makeRunway(a: RunwayEnd, b: RunwayEnd): Runway {
  return {
    width: 45,
    surface_type: 1 as Runway['surface_type'],
    shoulder_surface_type: 0 as Runway['shoulder_surface_type'],
    shoulder_width: 0,
    smoothness: 0.25,
    centerline_lights: true,
    edge_lights: true,
    auto_distance_remaining_signs: false,
    ends: [a, b],
  };
}

function airport(runways: Runway[]): ParsedAirport {
  return { runways } as unknown as ParsedAirport;
}

describe('getAirportBounds', () => {
  it('returns the rectangle around a single runway', () => {
    const a = makeEnd('09', 51.4775, -0.4614);
    const b = makeEnd('27', 51.4646, -0.4339);
    const bounds = getAirportBounds(airport([makeRunway(a, b)]), [-0.45, 51.47]);
    expect(bounds).toEqual([
      [-0.4614, 51.4646],
      [-0.4339, 51.4775],
    ]);
  });

  it('expands to cover all runway endpoints across multiple runways', () => {
    const a1 = makeEnd('18C', 39.07, -84.69);
    const a2 = makeEnd('36C', 39.05, -84.69);
    const b1 = makeEnd('18L', 39.06, -84.7);
    const b2 = makeEnd('36L', 39.04, -84.7);
    const bounds = getAirportBounds(
      airport([makeRunway(a1, a2), makeRunway(b1, b2)]),
      [-84.69, 39.05]
    );
    expect(bounds).toEqual([
      [-84.7, 39.04],
      [-84.69, 39.07],
    ]);
  });

  it('falls back to point bounds when there are no runways', () => {
    const fallback: [number, number] = [-84.667, 39.046];
    const bounds = getAirportBounds(airport([]), fallback);
    expect(bounds).toEqual([fallback, fallback]);
  });
});

describe('airportBoundsHaveArea', () => {
  it('is true for a real bbox', () => {
    expect(
      airportBoundsHaveArea([
        [-1, 50],
        [1, 51],
      ])
    ).toBe(true);
  });

  it('is false for a degenerate point bbox', () => {
    expect(
      airportBoundsHaveArea([
        [-1, 50],
        [-1, 50],
      ])
    ).toBe(false);
  });
});
