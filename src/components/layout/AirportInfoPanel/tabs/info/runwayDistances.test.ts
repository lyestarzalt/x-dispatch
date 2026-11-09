import { describe, expect, it } from 'vitest';
import type { Runway, RunwayEnd } from '@/types/apt';
import { landingDistanceFeet } from './runwayDistances';

/** KSAN 09/27 from apt.dat: 305 m displaced at 09, 551 m at 27. */
function ksan(): Runway {
  const end = (name: string, latitude: number, longitude: number, dthr: number): RunwayEnd =>
    ({ name, latitude, longitude, dthr_length: dthr }) as RunwayEnd;
  return {
    ends: [end('9', 32.7371282, -117.2043918, 305), end('27', 32.7299936, -117.1749683, 551)],
  } as Runway;
}

describe('landingDistanceFeet', () => {
  it('takes the displaced threshold off the landing end only', () => {
    const rwy = ksan();
    // Full length about 9,397 ft; 305 m is 1,001 ft, 551 m is 1,808 ft.
    expect(landingDistanceFeet(rwy, 0)).toBeCloseTo(8396, -1);
    expect(landingDistanceFeet(rwy, 1)).toBeCloseTo(7589, -1);
  });

  it('equals the full length when the threshold is not displaced', () => {
    const rwy = ksan();
    rwy.ends[0].dthr_length = 0;
    expect(landingDistanceFeet(rwy, 0)).toBeCloseTo(9397, -1);
  });
});
