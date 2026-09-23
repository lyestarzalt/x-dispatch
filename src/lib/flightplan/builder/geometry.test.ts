import { describe, expect, it } from 'vitest';
import {
  estimateMinutes,
  greatCircleNm,
  isEastbound,
  pathDistanceNm,
  smoothRoutePath,
  suggestCruiseAltitudeFt,
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
