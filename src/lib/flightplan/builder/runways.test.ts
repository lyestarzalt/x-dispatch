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
    expect(runwayEndsFromApt(APT)).toEqual(['06', '18R', '24', '36L']);
  });

  it('returns nothing for an airport without land runways', () => {
    expect(runwayEndsFromApt('1 10 0 0 XXXX Heliport\n102 H1 0 0 0 20 20 1 0 0 0 0')).toEqual([]);
  });
});
