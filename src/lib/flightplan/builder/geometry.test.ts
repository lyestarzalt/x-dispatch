import { describe, expect, it } from 'vitest';
import {
  estimateMinutes,
  greatCircleNm,
  greatCirclePoints,
  isEastbound,
  lonDeltaDeg,
  pathDistanceNm,
  smoothRoutePath,
  suggestCruiseAltitudeFt,
  unwrapLongitude,
} from './geometry';

const EHAM = { latitude: 52.3086, longitude: 4.7639 };
const EDDF = { latitude: 50.0333, longitude: 8.5706 };

describe('geometry', () => {
  it('measures the Amsterdam to Frankfurt leg', () => {
    const nm = greatCircleNm(EHAM, EDDF);
    expect(nm).toBeGreaterThan(190);
    expect(nm).toBeLessThan(205);
    expect(pathDistanceNm([EHAM, EDDF])).toBeCloseTo(nm, 6);
  });

  it('estimates time per class with a terminal allowance', () => {
    expect(estimateMinutes(450, 'jet')).toBe(80);
    expect(estimateMinutes(0, 'prop')).toBe(0);
  });

  it('suggests hemispheric cruise levels within class caps', () => {
    expect(suggestCruiseAltitudeFt(200, 'jet', true)).toBe(29000);
    expect(suggestCruiseAltitudeFt(200, 'jet', false)).toBe(30000);
    expect(suggestCruiseAltitudeFt(2000, 'jet', true)).toBe(41000);
    expect(suggestCruiseAltitudeFt(50, 'prop', true)).toBe(3000);
  });

  it('rounds a right-angle corner with an arc that stays near the corner', () => {
    const corner = { latitude: 50, longitude: 8 };
    const path = [{ latitude: 50, longitude: 7 }, corner, { latitude: 51, longitude: 8 }];
    const smooth = smoothRoutePath(path, 3);
    expect(smooth.length).toBeGreaterThan(path.length);
    expect(smooth[0]).toEqual(path[0]);
    expect(smooth[smooth.length - 1]).toEqual(path[2]);
    // No sample sits on the corner itself and none strays further than the tangent length.
    for (const p of smooth.slice(1, -1)) {
      expect(greatCircleNm(p, corner)).toBeLessThan(5);
      expect(greatCircleNm(p, corner)).toBeGreaterThan(0.5);
    }
  });

  it('keeps shallow turns hugging the corner', () => {
    // A 10 degree bend; the arc must stay within the tangent length of the corner.
    const corner = { latitude: 25, longitude: 53 };
    const path = [{ latitude: 25, longitude: 52 }, corner, { latitude: 25.16, longitude: 54 }];
    const smooth = smoothRoutePath(path, 3);
    expect(smooth.length).toBeGreaterThan(path.length);
    for (const p of smooth.slice(1, -1)) {
      expect(greatCircleNm(p, corner)).toBeLessThan(1);
    }
  });

  it('leaves straight and two-point paths alone', () => {
    const straight = [
      { latitude: 50, longitude: 7 },
      { latitude: 50, longitude: 8 },
      { latitude: 50, longitude: 9 },
    ];
    expect(smoothRoutePath(straight, 3)).toEqual(straight);
    expect(smoothRoutePath(straight.slice(0, 2), 3)).toEqual(straight.slice(0, 2));
  });

  it('knows which way is east', () => {
    expect(isEastbound(EHAM, EDDF)).toBe(true);
    expect(isEastbound(EDDF, EHAM)).toBe(false);
  });
});

describe('longitude unwrapping', () => {
  it('measures the short way round', () => {
    expect(lonDeltaDeg(170, -170)).toBe(20);
    expect(lonDeltaDeg(-170, 170)).toBe(-20);
    expect(lonDeltaDeg(-73.8, -0.5)).toBeCloseTo(73.3);
    // Exactly opposite: either way round is 180.
    expect(Math.abs(lonDeltaDeg(10, -170))).toBe(180);
  });

  it('shifts a longitude by whole turns to stay next to the previous one', () => {
    expect(unwrapLongitude(170, -170)).toBe(190);
    expect(unwrapLongitude(190, 150)).toBe(150);
    expect(unwrapLongitude(-170, 170)).toBe(-190);
    expect(unwrapLongitude(4, 8)).toBe(8);
  });
});

describe('greatCirclePoints', () => {
  it('bends poleward on a long east-west leg', () => {
    const kjfk = { latitude: 40.6, longitude: -73.8 };
    const vhhh = { latitude: 22.3, longitude: 113.9 };
    const pts = greatCirclePoints(kjfk, vhhh, 25);
    expect(pts).toHaveLength(25);
    expect(pts[0]).toEqual(kjfk);
    expect(pts[24]!.latitude).toBeCloseTo(22.3, 6);
    expect(Math.max(...pts.map((p) => p.latitude))).toBeGreaterThan(74);
  });

  it('is a straight interpolation along a meridian and handles identical points', () => {
    const pts = greatCirclePoints(
      { latitude: 0, longitude: 10 },
      { latitude: 60, longitude: 10 },
      4
    );
    expect(pts.map((p) => Math.round(p.latitude))).toEqual([0, 20, 40, 60]);
    expect(pts.every((p) => Math.abs(p.longitude - 10) < 1e-9)).toBe(true);
    expect(
      greatCirclePoints({ latitude: 1, longitude: 1 }, { latitude: 1, longitude: 1 }, 5)
    ).toHaveLength(2);
  });
});
