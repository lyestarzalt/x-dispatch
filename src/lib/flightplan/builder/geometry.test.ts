import { describe, expect, it } from 'vitest';
import {
  estimateMinutes,
  greatCircleNm,
  isEastbound,
  pathDistanceNm,
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

  it('knows which way is east', () => {
    expect(isEastbound(EHAM, EDDF)).toBe(true);
    expect(isEastbound(EDDF, EHAM)).toBe(false);
  });
});
