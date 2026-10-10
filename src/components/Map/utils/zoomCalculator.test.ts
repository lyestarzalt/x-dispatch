import { describe, expect, it } from 'vitest';
import type { WaterRunway } from '@/types/apt';
import { calculateOptimalZoom } from './zoomCalculator';

function waterRunway(lengthDegLat: number): WaterRunway {
  return {
    width: 50,
    perimeter_buoys: false,
    ends: [
      { name: '18W', latitude: 62.5, longitude: -153.9 },
      { name: '36W', latitude: 62.5 + lengthDegLat, longitude: -153.9 },
    ],
  };
}

describe('calculateOptimalZoom', () => {
  it('falls back to the default zoom with no runways at all', () => {
    expect(calculateOptimalZoom([], [])).toBe(14);
  });

  it('frames a seaplane base by its water runway length', () => {
    // 0.02° of latitude is about 2.2 km: a regional-sized lane.
    expect(calculateOptimalZoom([], [waterRunway(0.02)])).toBe(15);
  });
});
