import { describe, expect, it } from 'vitest';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { estimateMinutes, minutesToNm } from './geometry';
import { type RandomRouteCriteria, findRandomRoutes } from './randomRoute';

const airport = (
  icao: string,
  lat: number,
  lon: number,
  extra: Partial<Airport> = {}
): Airport => ({
  icao,
  name: icao,
  lat,
  lon,
  type: 'land',
  isCustom: false,
  runwayCount: 2,
  surfaceType: 'paved',
  elevation: 0,
  country: 'AA',
  ...extra,
});

const origin = airport('ORIG', 0, 0);

const criteria = (extra: Partial<RandomRouteCriteria> = {}): RandomRouteCriteria => ({
  minNm: 100,
  maxNm: 400,
  category: 'jet',
  scope: 'any',
  customOnly: false,
  weather: [],
  atcOnly: false,
  ...extra,
});

/** One degree of longitude on the equator is 60 nm. */
const atNm = (icao: string, nm: number, extra: Partial<Airport> = {}) =>
  airport(icao, 0, nm / 60, extra);

const icaos = (routes: { airport: Airport }[]) => routes.map((r) => r.airport.icao).sort();

describe('findRandomRoutes', () => {
  it('keeps destinations inside the distance band and drops the origin', () => {
    const list = [origin, atNm('NEAR', 50), atNm('MIDA', 150), atNm('MIDB', 300), atNm('FAR', 600)];
    expect(icaos(findRandomRoutes(list, origin, criteria()))).toEqual(['MIDA', 'MIDB']);
  });

  it('skips heliports, seaplane bases and fields without runways', () => {
    const list = [
      origin,
      atNm('HELI', 200, { type: 'heliport' }),
      atNm('SEAP', 200, { type: 'seaplane' }),
      atNm('NORW', 200, { runwayCount: 0 }),
      atNm('GOOD', 200),
    ];
    expect(icaos(findRandomRoutes(list, origin, criteria()))).toEqual(['GOOD']);
  });

  it('needs a paved runway for anything faster than a piston', () => {
    const list = [origin, atNm('GRAS', 200, { surfaceType: 'unpaved' })];
    expect(findRandomRoutes(list, origin, criteria({ category: 'jet' }))).toEqual([]);
    expect(icaos(findRandomRoutes(list, origin, criteria({ category: 'prop' })))).toEqual(['GRAS']);
  });

  it('filters domestic and international legs by country', () => {
    const list = [origin, atNm('HOME', 200), atNm('ABRD', 200, { country: 'BB' })];
    expect(icaos(findRandomRoutes(list, origin, criteria({ scope: 'domestic' })))).toEqual([
      'HOME',
    ]);
    expect(icaos(findRandomRoutes(list, origin, criteria({ scope: 'international' })))).toEqual([
      'ABRD',
    ]);
  });

  it('can keep only airports with custom scenery', () => {
    const list = [origin, atNm('STCK', 200), atNm('CUST', 200, { isCustom: true })];
    expect(icaos(findRandomRoutes(list, origin, criteria({ customOnly: true })))).toEqual(['CUST']);
  });

  it('matches any of the chosen weather categories and reports them', () => {
    const list = [origin, atNm('SNOW', 200), atNm('SUNY', 200), atNm('NOWX', 200)];
    const weatherByIcao = new Map([
      ['SNOW', ['snow' as const, 'lowCeiling' as const]],
      ['SUNY', ['clear' as const]],
    ]);
    const routes = findRandomRoutes(list, origin, criteria({ weather: ['snow', 'fog'] }), {
      weatherByIcao,
    });
    expect(icaos(routes)).toEqual(['SNOW']);
    expect(routes[0]?.weather).toEqual(['snow', 'lowCeiling']);
  });

  it('keeps only staffed airports when ATC is required, matching ICAO or IATA', () => {
    const list = [
      origin,
      atNm('EGLL', 200, { iataCode: 'LHR' }),
      atNm('LFPG', 200),
      atNm('EDDF', 200, { iataCode: 'FRA' }),
    ];
    const staffedPrefixes = new Set(['LFPG', 'FRA']);
    const routes = findRandomRoutes(list, origin, criteria({ atcOnly: true }), {
      staffedPrefixes,
    });
    expect(icaos(routes)).toEqual(['EDDF', 'LFPG']);
    expect(routes.every((r) => r.staffed)).toBe(true);
  });

  it('returns at most the requested count, nearest first', () => {
    const list = [origin, ...Array.from({ length: 20 }, (_, i) => atNm(`A${i}`, 110 + i * 10))];
    const routes = findRandomRoutes(list, origin, criteria(), {}, 5);
    expect(routes).toHaveLength(5);
    const distances = routes.map((r) => r.distanceNm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it('draws different picks for different random sources', () => {
    const list = [origin, ...Array.from({ length: 20 }, (_, i) => atNm(`A${i}`, 110 + i * 10))];
    const low = findRandomRoutes(list, origin, criteria(), {}, 3, () => 0);
    const high = findRandomRoutes(list, origin, criteria(), {}, 3, () => 0.999);
    expect(icaos(low)).not.toEqual(icaos(high));
  });

  it('estimates block minutes with the planner formula', () => {
    const list = [origin, atNm('DEST', 300)];
    const [route] = findRandomRoutes(list, origin, criteria());
    expect(route?.minutes).toBe(estimateMinutes(route?.distanceNm ?? 0, 'jet'));
  });
});

describe('minutesToNm', () => {
  it('inverts the block time estimate', () => {
    const nm = minutesToNm(120, 'jet');
    expect(estimateMinutes(nm, 'jet')).toBeCloseTo(120, 0);
  });

  it('never goes below zero for legs shorter than the terminal allowance', () => {
    expect(minutesToNm(5, 'jet')).toBe(0);
  });
});
