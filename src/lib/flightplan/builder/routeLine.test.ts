import { describe, expect, it } from 'vitest';
import { bearingDeg, greatCircleNm } from './geometry';
import { routeLinePoints, turnOntoFix } from './routeLine';

const RWY_09 = { name: '09', latitude: 52, longitude: 4, headingDeg: 90, lengthNm: 2 };
const RWY_27 = { name: '27', latitude: 50, longitude: 8.05, headingDeg: 270, lengthNm: 2 };

describe('turnOntoFix', () => {
  it('turns back through the tail and leaves tangent toward a fix behind', () => {
    const from = { latitude: 52, longitude: 4 };
    // Flying east; the fix is 20 nm to the south-west.
    const fix = { latitude: 51.76, longitude: 3.6 };
    const arc = turnOntoFix(from, 90, fix, 2);
    expect(arc.length).toBeGreaterThan(5);
    // Every arc point stays within one turn diameter of the start.
    for (const p of arc) expect(greatCircleNm(from, p)).toBeLessThanOrEqual(4.05);
    // The exit heading points at the fix.
    const exit = arc[arc.length - 1]!;
    const before = arc[arc.length - 2]!;
    const diff = Math.abs(bearingDeg(before, exit) - bearingDeg(exit, fix));
    expect(Math.min(diff, 360 - diff)).toBeLessThan(8);
  });

  it('barely turns for a fix nearly straight ahead', () => {
    const from = { latitude: 52, longitude: 4 };
    const fix = { latitude: 52.02, longitude: 4.5 };
    const arc = turnOntoFix(from, 90, fix, 2);
    expect(arc.length).toBeLessThanOrEqual(2);
  });
});

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

  it('rolls down the runway, climbs straight, then turns onto the first fix', () => {
    const wps = [
      { via: 'ADEP', latitude: 52.01, longitude: 4.01 },
      { via: 'FIX', latitude: 51.7, longitude: 3.5 },
      { via: 'FIX', latitude: 51.5, longitude: 3.5 },
    ];
    const line = routeLinePoints(wps, { departure: RWY_09 });
    expect(line[0]).toEqual({ latitude: 52, longitude: 4 });
    expect(bearingDeg(line[0]!, line[1]!)).toBeCloseTo(90, 0);
    expect(greatCircleNm(line[0]!, line[2]!)).toBeCloseTo(4, 1);
    // No point sits farther from the start than the fixes themselves.
    for (const p of line) expect(greatCircleNm(line[0]!, p)).toBeLessThan(40);
    // The last fix is reached exactly.
    expect(line[line.length - 1]).toEqual({ latitude: 51.5, longitude: 3.5 });
    // Consecutive headings never jump by more than the arc step plus a fly-by sample.
    for (let i = 2; i < line.length; i++) {
      const a = bearingDeg(line[i - 2]!, line[i - 1]!);
      const b = bearingDeg(line[i - 1]!, line[i]!);
      const diff = Math.abs(a - b);
      expect(Math.min(diff, 360 - diff)).toBeLessThan(30);
    }
  });

  it('joins a straight final onto the arrival threshold', () => {
    const wps = [
      { via: 'FIX', latitude: 50.5, longitude: 7 },
      { via: 'ADES', latitude: 50.01, longitude: 8 },
    ];
    const line = routeLinePoints(wps, { arrival: RWY_27 });
    const last = line[line.length - 1]!;
    const before = line[line.length - 2]!;
    expect(last).toEqual({ latitude: 50, longitude: 8.05 });
    expect(bearingDeg(before, last)).toBeCloseTo(270, 0);
  });
});
