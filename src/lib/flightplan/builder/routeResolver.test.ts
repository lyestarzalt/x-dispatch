import { describe, expect, it, vi } from 'vitest';
import { greatCircleNm } from './geometry';
import { parseNatMessage, setOceanicTracks } from './oceanicTracks';
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
  getAirwaysByName: (name: string) => AIRWAYS[name] ?? [],
}));

const AIRWAYS: Record<string, object[]> = {
  L1: [
    { name: 'L1', fromFix: 'AAAAA', toFix: 'BBBBB', direction: 0, baseFl: 0, topFl: 0 },
    { name: 'L1', fromFix: 'BBBBB', toFix: 'CCCCC', direction: 0, baseFl: 0, topFl: 0 },
  ],
  // One way, A to C only, published FL245 to FL460.
  U1: [
    { name: 'U1', fromFix: 'AAAAA', toFix: 'BBBBB', direction: 1, baseFl: 245, topFl: 460 },
    { name: 'U1', fromFix: 'BBBBB', toFix: 'CCCCC', direction: 1, baseFl: 245, topFl: 460 },
  ],
  // Low airway with an open top, used to narrow the route band from below.
  V1: [{ name: 'V1', fromFix: 'BBBBB', toFix: 'CCCCC', direction: 0, baseFl: 85, topFl: 0 }],
  // Low airway capped at FL150: with U1 ahead of it no level fits the whole route.
  W1: [{ name: 'W1', fromFix: 'BBBBB', toFix: 'CCCCC', direction: 0, baseFl: 0, topFl: 150 }],
};

const draft = (routeText: string, cruiseAltitudeFt: number | null = 36000) => ({
  departure: { icao: 'EGXX', latitude: 50, longitude: -8 },
  arrival: { icao: 'CYXX', latitude: 50, longitude: -52 },
  routeText,
  cruiseAltitudeFt,
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

describe('resolveRoute airway checks', () => {
  it('flags an airway walked against its one-way direction, and still uses it', () => {
    const res = resolveRoute({
      ...draft('CCCCC U1 AAAAA'),
      departure: { icao: 'CYXX', latitude: 50, longitude: -52 },
      arrival: { icao: 'EGXX', latitude: 50, longitude: -8 },
    })!;
    expect(res.tokens[1]).toMatchObject({ status: 'warning', issue: 'airwayWrongWay' });
    expect(res.plan.waypoints.map((w) => w.id)).toEqual([
      'CYXX',
      'CCCCC',
      'BBBBB',
      'AAAAA',
      'EGXX',
    ]);
  });

  it('flags an airway not published at the cruise level and quotes its band', () => {
    const res = resolveRoute(draft('AAAAA U1 CCCCC', 18000))!;
    expect(res.tokens[1]).toMatchObject({
      status: 'warning',
      issue: 'airwayLevel',
      levels: { minFt: 24500, maxFt: 46000 },
    });
    expect(resolveRoute(draft('AAAAA U1 CCCCC', 36000))!.tokens[1]?.status).toBe('ok');
  });

  it('skips the level check without a cruise altitude', () => {
    expect(resolveRoute(draft('AAAAA U1 CCCCC', null))!.tokens[1]?.status).toBe('ok');
  });

  it('reports the band every airway allows together', () => {
    expect(resolveRoute(draft('AAAAA U1 BBBBB V1 CCCCC'))!.levels).toEqual({
      minFt: 24500,
      maxFt: 46000,
    });
    expect(resolveRoute(draft('BBBBB V1 CCCCC'))!.levels).toEqual({ minFt: 8500, maxFt: null });
    expect(resolveRoute(draft('AAAAA DCT CCCCC'))!.levels).toEqual({ minFt: null, maxFt: null });
  });

  it('names the airway that sets the floor and the one that sets the ceiling', () => {
    const res = resolveRoute(draft('AAAAA U1 BBBBB W1 CCCCC'))!;
    expect(res.levels).toEqual({ minFt: 24500, maxFt: 15000 });
    expect(res.levelSetters).toEqual({ floor: 'U1', ceiling: 'W1' });
    expect(resolveRoute(draft('AAAAA U1 BBBBB V1 CCCCC'))!.levelSetters).toEqual({
      floor: 'U1',
      ceiling: 'U1',
    });
    expect(resolveRoute(draft('AAAAA DCT CCCCC'))!.levelSetters).toEqual({});
  });
});

describe('resolveRoute with a NAT track', () => {
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const far = new Date(Date.now() + 3_600_000).toISOString();
  const track = 'A AAAAA BBBBB CCCCC\nEAST LVLS NIL\nWEST LVLS 350 360';

  it('accepts the designator for the whole track', () => {
    setOceanicTracks(parseNatMessage(track, past, far));
    const result = resolveRoute(draft('AAAAA NATA CCCCC'))!;
    expect(result.tokens.find((t) => t.text === 'NATA')).toMatchObject({ status: 'ok' });
    expect(result.plan.waypoints.map((w) => `${w.id}/${w.via}`)).toEqual([
      'EGXX/ADEP',
      'AAAAA/DRCT',
      'BBBBB/NATA',
      'CCCCC/NATA',
      'CYXX/ADES',
    ]);
  });

  it('warns when the designator covers only part of the track, but still uses it', () => {
    setOceanicTracks(parseNatMessage(track, past, far));
    const result = resolveRoute(draft('AAAAA NATA BBBBB'))!;
    expect(result.tokens.find((t) => t.text === 'NATA')).toMatchObject({
      status: 'warning',
      issue: 'trackPartial',
    });
    expect(result.plan.waypoints.map((w) => w.id)).toEqual(['EGXX', 'AAAAA', 'BBBBB', 'CYXX']);
  });
});
