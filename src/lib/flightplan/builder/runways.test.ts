import { describe, expect, it } from 'vitest';
import { runwayEndsFromApt } from './runways';

const APT = `
1 -11 1 0 EHAM Amsterdam Schiphol
100 45.11 1 0 0.00 1 3 0 18R 52.3600 4.7117 0 0 3 0 0 0 36L 52.3286 4.7089 0 0 3 0 0 0
100 45.11 1 0 0.00 1 3 0 06 52.2887 4.7373 0 0 3 0 0 0 24 52.3044 4.7783 0 0 3 0 0 0
101 30.00 0 08 52.30 4.70 26 52.31 4.72
102 H1 52.31 4.75 0 20 20 1 0 0 0 0
`;

describe('runwayEndsFromApt', () => {
  it('lists land runway ends in numeric order and ignores water and helipads', () => {
    expect(runwayEndsFromApt(APT).map((e) => e.name)).toEqual(['06', '18R', '24', '36L']);
  });

  it('gives each end its threshold, heading along the runway and length', () => {
    const ends = runwayEndsFromApt(APT);
    const r18 = ends.find((e) => e.name === '18R')!;
    const r36 = ends.find((e) => e.name === '36L')!;
    expect(r18.latitude).toBeCloseTo(52.36, 4);
    expect(r18.headingDeg).toBeGreaterThan(175);
    expect(r18.headingDeg).toBeLessThan(185);
    expect((r36.headingDeg + 5) % 360).toBeLessThan(10);
    expect(r18.lengthNm).toBeCloseTo(r36.lengthNm, 6);
    expect(r18.lengthNm).toBeGreaterThan(1.8);
    expect(r18.lengthNm).toBeLessThan(2.0);
  });

  it('returns nothing for an airport without land runways', () => {
    expect(runwayEndsFromApt('1 10 0 0 XXXX Heliport\n102 H1 0 0 0 20 20 1 0 0 0 0')).toEqual([]);
  });
});
