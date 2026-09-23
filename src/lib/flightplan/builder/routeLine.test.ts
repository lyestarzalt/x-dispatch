import { describe, expect, it } from 'vitest';
import { bearingDeg, greatCircleNm } from './geometry';
import { routeLinePoints } from './routeLine';

const RWY_09 = { name: '09', latitude: 52, longitude: 4, headingDeg: 90, lengthNm: 2 };
const RWY_27 = { name: '27', latitude: 50, longitude: 8.05, headingDeg: 270, lengthNm: 2 };

describe('routeLinePoints', () => {
  it('uses the airport datum when no runway is chosen', () => {
    const wps = [
      { via: 'ADEP', latitude: 52, longitude: 4 },
      { via: 'ADES', latitude: 50, longitude: 8 },
    ];
    expect(routeLinePoints(wps)).toEqual([
      { latitude: 52, longitude: 4 },
      { latitude: 50, longitude: 8 },
    ]);
  });

  it('rolls down the departure runway and climbs straight ahead first', () => {
    const wps = [
      { via: 'ADEP', latitude: 52.01, longitude: 4.01 },
      { via: 'FIX', latitude: 52.5, longitude: 5 },
    ];
    const line = routeLinePoints(wps, { departure: RWY_09 });
    expect(line).toHaveLength(4);
    expect(line[0]).toEqual({ latitude: 52, longitude: 4 });
    expect(bearingDeg(line[0]!, line[1]!)).toBeCloseTo(90, 0);
    expect(greatCircleNm(line[0]!, line[2]!)).toBeCloseTo(4, 1);
  });

  it('joins a straight final onto the arrival threshold', () => {
    const wps = [
      { via: 'FIX', latitude: 50.5, longitude: 7 },
      { via: 'ADES', latitude: 50.01, longitude: 8 },
    ];
    const line = routeLinePoints(wps, { arrival: RWY_27 });
    expect(line).toHaveLength(3);
    expect(line[2]).toEqual({ latitude: 50, longitude: 8.05 });
    expect(bearingDeg(line[1]!, line[2]!)).toBeCloseTo(270, 0);
    expect(greatCircleNm(line[1]!, line[2]!)).toBeCloseTo(6, 1);
  });
});
