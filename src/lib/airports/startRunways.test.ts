import { describe, expect, it } from 'vitest';
import type { Helipad, Runway, WaterRunway } from '@/types/apt';
import { SurfaceType } from '@/types/apt';
import { helipadStartRow, startRunways } from './startRunways';

function land(name1: string, name2: string, startRow?: number): Runway {
  const end = (name: string) => ({
    name,
    latitude: 49,
    longitude: 2.5,
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
    ends: [end(name1), end(name2)],
    startRow,
  };
}

function water(name1: string, name2: string, startRow?: number): WaterRunway {
  return {
    width: 50,
    perimeter_buoys: false,
    ends: [
      { name: name1, latitude: 62.5, longitude: -153.9 },
      { name: name2, latitude: 62.51, longitude: -153.9 },
    ],
    startRow,
  };
}

describe('startRunways', () => {
  it('lists land runways first, then water lanes as water-surface runways', () => {
    const list = startRunways({ runways: [land('09', '27')], waterRunways: [water('18W', '36W')] });
    expect(list.map((r) => `${r.ends[0].name}/${r.ends[1].name}`)).toEqual(['09/27', '18W/36W']);
    expect(list[1]!.surface_type).toBe(SurfaceType.WATER_RUNWAY);
    expect(list[1]!.width).toBe(50);
  });

  it('keeps the start row the parser recorded', () => {
    const list = startRunways({
      runways: [land('09', '27', 0), land('18', '36', 3)],
      waterRunways: [water('18W', '36W', 1)],
    });
    expect(list.map((r) => r.startRow)).toEqual([0, 3, 1]);
  });

  it('falls back to land-then-water order when no row was recorded', () => {
    const list = startRunways({ runways: [land('09', '27')], waterRunways: [water('18W', '36W')] });
    expect(list.map((r) => r.startRow)).toEqual([0, 1]);
  });
});

describe('helipadStartRow', () => {
  const pad = (startRow?: number): Helipad => ({
    name: 'H1',
    latitude: 49,
    longitude: 2.5,
    heading: 0,
    length: 20,
    width: 20,
    surface_type: SurfaceType.CONCRETE,
    startRow,
  });

  it('uses the recorded row when there is one', () => {
    expect(helipadStartRow(pad(2), 0, { runways: [land('09', '27')], waterRunways: [] })).toBe(2);
  });

  it('otherwise counts past every land and water runway', () => {
    const airport = { runways: [land('09', '27')], waterRunways: [water('18W', '36W')] };
    expect(helipadStartRow(pad(), 0, airport)).toBe(2);
    expect(helipadStartRow(pad(), 1, airport)).toBe(3);
  });
});
