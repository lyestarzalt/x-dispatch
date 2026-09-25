import { describe, expect, it, vi } from 'vitest';
import { greatCircleNm } from './geometry';
import { resolveRoute } from './routeResolver';

// Three fixes 20° apart along 50N: A to C is about 1540 nm, past the lookup radius.
const FIXES: Record<string, { latitude: number; longitude: number }> = {
  AAAAA: { latitude: 50, longitude: -10 },
  BBBBB: { latitude: 50, longitude: -30 },
  CCCCC: { latitude: 50, longitude: -50 },
};

vi.mock('@/lib/utils/logger', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
});
vi.mock('@/lib/xplaneServices/dataService/navdata/navCache', () => ({
  getNavaidEnrichedById: () => null,
  getWaypointNearestById: (id: string, lat: number, lon: number, maxNm: number) => {
    const p = FIXES[id];
    if (!p || greatCircleNm({ latitude: lat, longitude: lon }, p) > maxNm) return null;
    return { id, ...p, region: 'XX' };
  },
  getAirwaysByName: (name: string) =>
    name === 'L1'
      ? [
          { name: 'L1', fromFix: 'AAAAA', toFix: 'BBBBB' },
          { name: 'L1', fromFix: 'BBBBB', toFix: 'CCCCC' },
        ]
      : [],
}));

const draft = (routeText: string) => ({
  departure: { icao: 'EGXX', latitude: 50, longitude: -8 },
  arrival: { icao: 'CYXX', latitude: 50, longitude: -52 },
  routeText,
});

describe('resolveRoute', () => {
  it('follows a long airway fix by fix so the exit is found beyond the lookup radius', () => {
    const res = resolveRoute(draft('AAAAA L1 CCCCC'))!;
    expect(res.tokens.map((t) => t.status)).toEqual(['ok', 'ok', 'ok']);
    expect(res.plan.waypoints.map((w) => w.id)).toEqual([
      'EGXX',
      'AAAAA',
      'BBBBB',
      'CCCCC',
      'CYXX',
    ]);
    expect(res.plan.waypoints[2]?.via).toBe('L1');
  });

  it('flags an airway that does not reach the exit and continues direct', () => {
    const res = resolveRoute(draft('AAAAA L1 BBBBB DCT CCCCC'))!;
    expect(res.tokens.map((t) => t.status)).toEqual(['ok', 'ok', 'ok', 'ok', 'ok']);
    const res2 = resolveRoute(draft('BBBBB Z9 CCCCC'))!;
    expect(res2.tokens[1]).toMatchObject({ status: 'unknown', issue: 'notFound' });
  });
});
