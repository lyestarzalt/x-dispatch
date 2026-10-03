import { describe, expect, it } from 'vitest';
import type { AirportProcedures, Procedure } from '@/types/navigation';
import { normalizeRunwayName, runwayEndsFromApt, runwaysFromProcedures } from './runways';

const APT = `
1 -11 1 0 EHAM Amsterdam Schiphol
100 45.11 1 0 0.00 1 3 0 18R 52.3600 4.7117 0 0 3 0 0 0 36L 52.3286 4.7089 0 0 3 0 0 0
100 45.11 1 0 0.00 1 3 0 06 52.2887 4.7373 0 0 3 0 0 0 24 52.3044 4.7783 0 0 3 0 0 0
101 30.00 0 08 52.30 4.70 26 52.31 4.72
102 H1 52.31 4.75 0 20 20 1 0 0 0 0
`;

// Kennedy as the scenery gateway writes it: 04/22 have no leading zero.
const KJFK = `
1 13 1 0 KJFK John F Kennedy Intl
100 60.96 2 2527 0.00 1 3 0 13L 40.6577726 -73.7902528 277 0 3 2 1 3 31R 40.6437215 -73.7592708 313 0 3 8 1 3
100 60.00 2 2527 0.00 1 3 0  4L 40.6220201 -73.7855859 141 0 3 0 1 3 22R 40.6505195 -73.7633136 1045 0 3 0 0 3
100 60.96 2 2527 0.00 1 3 0 13R 40.6483667 -73.8167248 623 0 3 0 0 1 31L 40.6279923 -73.7717745 994 0 3 0 0 3
100 60.96 27 1227 0.00 1 3 0  4R 40.6254255 -73.7703494 0 0 3 2 1 3 22L 40.6452357 -73.7548617 0 0 3 2 1 3
`;

// Bengaluru mixes both spellings in one block.
const VOBL = `
1 3000 1 0 VOBL Kempegowda Intl
100 45.00 1 0 0.00 1 3 0 9R 13.1979 77.6960 0 0 3 0 0 0 27L 13.1990 77.7320 0 0 3 0 0 0
100 45.00 1 0 0.00 1 3 0 09L 13.2080 77.6900 0 0 3 0 0 0 27R 13.2090 77.7290 0 0 3 0 0 0
`;

function proc(type: Procedure['type'], name: string, runway: string | null): Procedure {
  return { type, name, runway, transition: null, waypoints: [] };
}

describe('normalizeRunwayName', () => {
  it('pads single-digit numbers and strips the CIFP prefix', () => {
    expect(normalizeRunwayName('4L')).toBe('04L');
    expect(normalizeRunwayName('7')).toBe('07');
    expect(normalizeRunwayName('RW04L')).toBe('04L');
    expect(normalizeRunwayName('rw9r')).toBe('09R');
    expect(normalizeRunwayName(' 04L ')).toBe('04L');
  });

  it('keeps already canonical names and the rarer suffixes', () => {
    expect(normalizeRunwayName('04L')).toBe('04L');
    expect(normalizeRunwayName('36C')).toBe('36C');
    expect(normalizeRunwayName('07S')).toBe('07S');
    expect(normalizeRunwayName('08T')).toBe('08T');
  });

  it('rejects anything that is not one runway end', () => {
    expect(normalizeRunwayName('ALL')).toBeUndefined();
    expect(normalizeRunwayName('RW04B')).toBeUndefined();
    expect(normalizeRunwayName('')).toBeUndefined();
    expect(normalizeRunwayName('H1')).toBeUndefined();
    expect(normalizeRunwayName('123')).toBeUndefined();
    expect(normalizeRunwayName('ALB')).toBeUndefined();
  });
});

describe('runwaysFromProcedures', () => {
  const procedures: AirportProcedures = {
    icao: 'KJFK',
    sids: [
      proc('SID', 'DEEZZ5', 'RW04B'),
      proc('SID', 'DEEZZ5', 'RW13L'),
      proc('SID', 'DEEZZ5', null),
    ],
    stars: [proc('STAR', 'PARCH4', 'ALL'), proc('STAR', 'CAMRN4', 'RW22B')],
    approaches: [
      proc('APPROACH', 'I04L', null),
      proc('APPROACH', 'R22LX', null),
      proc('APPROACH', 'S04R', null),
      proc('APPROACH', 'VDMA', null),
    ],
  };

  it('expands both-sides runways and reads approach runways from the ident', () => {
    expect([...runwaysFromProcedures(procedures)].sort()).toEqual([
      '04L',
      '04R',
      '13L',
      '22L',
      '22R',
    ]);
  });

  it('returns nothing without procedures', () => {
    expect(runwaysFromProcedures(null)).toEqual([]);
    expect(runwaysFromProcedures(undefined)).toEqual([]);
  });
});

describe('runwayEndsFromApt', () => {
  it('pads single-digit runway numbers and keeps their reciprocals', () => {
    expect(runwayEndsFromApt(KJFK).map((e) => e.name)).toEqual([
      '04L',
      '04R',
      '13L',
      '13R',
      '22L',
      '22R',
      '31L',
      '31R',
    ]);
    const r04l = runwayEndsFromApt(KJFK).find((e) => e.name === '04L')!;
    expect(r04l.latitude).toBeCloseTo(40.6220201, 6);
    expect(r04l.headingDeg).toBeGreaterThan(25);
    expect(r04l.headingDeg).toBeLessThan(45);
  });

  it('treats padded and unpadded spellings of different runways as different ends', () => {
    expect(runwayEndsFromApt(VOBL).map((e) => e.name)).toEqual(['09L', '09R', '27L', '27R']);
  });

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

  it('carries the airport elevation from the header row onto every runway end', () => {
    for (const end of runwayEndsFromApt(APT)) expect(end.elevationFt).toBe(-11);
  });

  it('returns nothing for an airport without land runways', () => {
    expect(runwayEndsFromApt('1 10 0 0 XXXX Heliport\n102 H1 0 0 0 20 20 1 0 0 0 0')).toEqual([]);
  });
});
