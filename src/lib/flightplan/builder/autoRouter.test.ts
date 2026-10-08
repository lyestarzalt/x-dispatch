import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AirwaySegment } from '@/types/navigation';
import {
  autoRoute,
  bandAllows,
  compressPath,
  crossTrackNm,
  legCrossesArea,
  limitToFeet,
  longitudeRanges,
  resetAutoRouterCacheForTests,
} from './autoRouter';
import {
  type NatMessage,
  parseNatMessage,
  resetOceanicTracksForTests,
  setNatMessages,
  setOceanicTracks,
} from './oceanicTracks';

interface MockFix {
  id: string;
  areaCode: string;
  latitude: number;
  longitude: number;
}
// Settable per test; one fix far from every test route keeps the graph from being empty.
const navdata = vi.hoisted(() => ({
  airways: [] as unknown[],
  waypoints: [{ id: 'ZZZZZ', areaCode: 'EG', latitude: 60, longitude: -5 }] as unknown[],
  waypointQueries: 0,
}));
vi.mock('@/lib/xplaneServices/dataService/navdata/navCache', () => ({
  getAllAirwaysFromDb: () => navdata.airways,
  getNavaidsInBounds: () => [],
  getWaypointsInBounds: () => {
    navdata.waypointQueries++;
    return navdata.waypoints;
  },
  getAirspacesInBounds: () => [],
}));
vi.mock('@/lib/utils/logger', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
});

const BASE_FIXES: MockFix[] = [{ id: 'ZZZZZ', areaCode: 'EG', latitude: 60, longitude: -5 }];

function segment(name: string, from: MockFix, to: MockFix): AirwaySegment {
  return {
    name,
    fromFix: from.id,
    fromRegion: from.areaCode,
    fromNavaidType: 11,
    toFix: to.id,
    toRegion: to.areaCode,
    toNavaidType: 11,
    isHigh: true,
    direction: 0,
    baseFl: 0,
    topFl: 0,
  } as AirwaySegment;
}

beforeEach(() => {
  navdata.airways = [];
  navdata.waypoints = [...BASE_FIXES];
  navdata.waypointQueries = 0;
  resetAutoRouterCacheForTests();
  resetOceanicTracksForTests();
});

describe('longitudeRanges', () => {
  it('pads a span that stays on one side of the antimeridian', () => {
    expect(longitudeRanges([4.7, -73.8], 5)).toEqual([[-78.8, 9.7]]);
  });

  it('splits a Pacific crossing into two spans meeting at 180', () => {
    expect(longitudeRanges([139.8, -118.4], 5)).toEqual([
      [134.8, 180],
      [-180, -113.4],
    ]);
  });
});

describe('crossTrackNm', () => {
  const a = { latitude: 40, longitude: -20 };
  const b = { latitude: 60, longitude: -20 };
  it('is zero on the track and grows with the offset', () => {
    expect(crossTrackNm(a, b, { latitude: 50, longitude: -20 })).toBeLessThan(0.01);
    // One degree of longitude at 50N is about 38.6 nm.
    const off = crossTrackNm(a, b, { latitude: 50, longitude: -19 });
    expect(off).toBeGreaterThan(38);
    expect(off).toBeLessThan(39);
  });
});

describe('compressPath', () => {
  it('keeps entry and exit fixes of each airway and every direct fix', () => {
    const text = compressPath([
      { fixId: 'ARNEM', airway: 'UL620' },
      { fixId: 'RKN', airway: 'UL620' },
      { fixId: 'OSN', airway: 'T180' },
      { fixId: 'KEKIX', airway: null },
    ]);
    expect(text).toBe('ARNEM UL620 OSN T180 KEKIX');
  });

  it('writes direct legs with DCT', () => {
    expect(
      compressPath([
        { fixId: 'AAA', airway: null },
        { fixId: 'BBB', airway: null },
      ])
    ).toBe('AAA DCT BBB');
  });

  it('handles a single fix', () => {
    expect(compressPath([{ fixId: 'ONLY', airway: null }])).toBe('ONLY');
  });
});

describe('bandAllows', () => {
  const seg = (baseFl: number, topFl: number) =>
    ({ baseFl, topFl }) as unknown as import('@/types/navigation').AirwaySegment;

  it('accepts open bands and levels inside the band', () => {
    expect(bandAllows(seg(0, 0), 410)).toBe(true);
    expect(bandAllows(seg(245, 460), 410)).toBe(true);
    expect(bandAllows(seg(245, 0), 410)).toBe(true);
  });

  it('rejects levels below the base or above the top', () => {
    expect(bandAllows(seg(245, 460), 90)).toBe(false);
    expect(bandAllows(seg(85, 245), 410)).toBe(false);
  });
});

describe('limitToFeet', () => {
  it('reads flight levels, feet and the ground and unlimited markers', () => {
    expect(limitToFeet('FL195')).toBe(19500);
    expect(limitToFeet('5000ft')).toBe(5000);
    expect(limitToFeet('GND')).toBe(0);
    expect(limitToFeet('UNL')).toBe(Infinity);
    expect(limitToFeet('notes')).toBeNull();
  });
});

describe('legCrossesArea', () => {
  const square = {
    ring: [
      [10, 50],
      [11, 50],
      [11, 51],
      [10, 51],
    ] as [number, number][],
    minLat: 50,
    maxLat: 51,
    minLon: 10,
    maxLon: 11,
    penalty: 2,
  };

  it('detects a leg passing through and ignores one passing beside', () => {
    expect(
      legCrossesArea({ latitude: 50.5, longitude: 9 }, { latitude: 50.5, longitude: 12 }, square)
    ).toBe(true);
    expect(
      legCrossesArea({ latitude: 52, longitude: 9 }, { latitude: 52, longitude: 12 }, square)
    ).toBe(false);
    expect(
      legCrossesArea({ latitude: 50.5, longitude: 10.5 }, { latitude: 53, longitude: 12 }, square)
    ).toBe(true);
  });
});

describe('autoRoute and NAT tracks', () => {
  const past = new Date(Date.now() - 3_600_000).toISOString();
  const far = new Date(Date.now() + 3_600_000).toISOString();
  const message = [
    'A 54/15 54/20 54/30 54/40',
    'EAST LVLS NIL',
    'WEST LVLS 340 350 360',
    'B 50/15 50/20 50/30 50/40',
    'EAST LVLS NIL',
    'WEST LVLS 340 350 360',
  ].join('\n');
  const input = {
    departure: { latitude: 50, longitude: -14.5 },
    arrival: { latitude: 50, longitude: -41 },
    from: { latitude: 50, longitude: -14.5 },
    to: { latitude: 50, longitude: -41 },
    cruiseAltitudeFt: 35000,
  };

  it('takes the nearer track when none is chosen', () => {
    setOceanicTracks(parseNatMessage(message, past, far));
    expect(autoRoute(input)?.routeText).toContain('NATB');
  });

  it('routes through the chosen track even when another is shorter', () => {
    setOceanicTracks(parseNatMessage(message, past, far));
    const result = autoRoute({ ...input, track: 'NATA' });
    expect(result?.routeText).toContain('NATA');
    expect(result?.routeText).not.toContain('NATB');
  });

  it('flies a track whole: entry to exit, never joining or leaving at a mid point', () => {
    setOceanicTracks(parseNatMessage(message, past, far));
    // The destination sits beside the third point of track A.
    const near = {
      ...input,
      departure: { latitude: 54, longitude: -14.5 },
      from: { latitude: 54, longitude: -14.5 },
      arrival: { latitude: 54.2, longitude: -31 },
      to: { latitude: 54.2, longitude: -31 },
    };
    const auto = autoRoute(near)?.routeText ?? '';
    expect(auto).not.toMatch(/NATA 5430N/);
    const chosen = autoRoute({ ...near, track: 'NATA' })?.routeText ?? '';
    expect(chosen).toMatch(/5415N NATA 5440N/);
  });

  it('penalises a track whose published levels skip the cruise level', () => {
    const levels = [
      'A 50/15 50/20 50/30 50/40',
      'EAST LVLS NIL',
      'WEST LVLS 350 360 370 400',
      'B 5030/15 5030/20 5030/30 5030/40',
      'EAST LVLS NIL',
      'WEST LVLS 380',
    ].join('\n');
    setOceanicTracks(parseNatMessage(levels, past, far));
    // A is the direct line; only its level list leaves FL380 out.
    expect(autoRoute({ ...input, cruiseAltitudeFt: 38000 })?.routeText).toContain('NATB');
    expect(autoRoute({ ...input, cruiseAltitudeFt: 36000 })?.routeText).toContain('NATA');
  });

  it("prefers the chosen track's NARs after the exit over an equal plain airway", () => {
    const exit = { id: 'EXITA', areaCode: 'CY', latitude: 50, longitude: -40 };
    const up = { id: 'UPFIX', areaCode: 'CY', latitude: 50.5, longitude: -43 };
    const down = { id: 'DNFIX', areaCode: 'CY', latitude: 49.5, longitude: -43 };
    const dest = { id: 'DESTF', areaCode: 'CY', latitude: 50, longitude: -46 };
    navdata.waypoints = [...BASE_FIXES, exit, up, down, dest];
    navdata.airways = [
      segment('N944A', exit, up),
      segment('N944A', up, dest),
      segment('Q100', exit, down),
      segment('Q100', down, dest),
    ];
    const withNar = [
      'A 50/15 50/20 50/30 EXITA',
      'EAST LVLS NIL',
      'WEST LVLS 350',
      'EUR RTS WEST NIL',
      'NAR N944A-',
    ].join('\n');
    setOceanicTracks(parseNatMessage(withNar, past, far));
    const result = autoRoute({ ...input, arrival: dest, to: dest, track: 'NATA' });
    expect(result?.routeText).toMatch(/EXITA N944A DESTF/);
  });

  it('joins a westbound track from its European feeder fix', () => {
    const feeder = { id: 'FEED1', areaCode: 'EG', latitude: 47, longitude: -10 };
    navdata.waypoints = [...BASE_FIXES, feeder];
    const text = [
      'F 47/15 47/20 47/30 47/40',
      'EAST LVLS NIL',
      'WEST LVLS 350',
      'EUR RTS WEST FEED1',
      'NAR NIL-',
    ].join('\n');
    setOceanicTracks(parseNatMessage(text, past, far));
    const result = autoRoute({
      departure: { latitude: 47, longitude: -9 },
      from: { latitude: 47, longitude: -9 },
      arrival: { latitude: 47, longitude: -41 },
      to: { latitude: 47, longitude: -41 },
      cruiseAltitudeFt: 35000,
    });
    expect(result?.routeText).toMatch(/^FEED1 DCT 4715N NATF 4740N/);
  });

  it('routes on the upcoming set when the direction flown has no set valid yet', () => {
    const from = new Date(Date.now() + 3_600_000).toISOString();
    const to = new Date(Date.now() + 7_200_000).toISOString();
    const upcomingWest: NatMessage = {
      origin: 'EGGX',
      eastbound: false,
      tmi: 1,
      validFrom: from,
      validTo: to,
      status: 'upcoming',
      remarks: '',
      tracks: parseNatMessage('A 50/15 50/20 50/30 50/40\nEAST LVLS NIL\nWEST LVLS 350', from, to),
    };
    // The eastbound set is the one valid now; it is no use westbound.
    const currentEast: NatMessage = {
      origin: 'CZQX',
      eastbound: true,
      tmi: 1,
      validFrom: past,
      validTo: far,
      status: 'current',
      remarks: '',
      tracks: parseNatMessage('Z 50/40 50/30 50/20 50/15\nEAST LVLS 350\nWEST LVLS NIL', past, far),
    };
    setNatMessages([currentEast, upcomingWest]);
    expect(autoRoute(input)?.routeText).toContain('NATA');
  });

  it('leaves the upcoming set alone while a set for that direction is valid, unless chosen', () => {
    const from = new Date(Date.now() + 3_600_000).toISOString();
    const to = new Date(Date.now() + 7_200_000).toISOString();
    const currentWest: NatMessage = {
      origin: 'EGGX',
      eastbound: false,
      tmi: 1,
      validFrom: past,
      validTo: far,
      status: 'current',
      remarks: '',
      tracks: parseNatMessage('B 50/15 50/20 50/30 50/40\nEAST LVLS NIL\nWEST LVLS 350', past, far),
    };
    const upcomingWest: NatMessage = {
      ...currentWest,
      validFrom: from,
      validTo: to,
      status: 'upcoming',
      tracks: parseNatMessage(
        'A 5030/15 5030/20 5030/30 5030/40\nEAST LVLS NIL\nWEST LVLS 350',
        from,
        to
      ),
    };
    setNatMessages([currentWest, upcomingWest]);
    expect(autoRoute(input)?.routeText).toContain('NATB');
    expect(autoRoute({ ...input, track: 'NATA' })?.routeText).toContain('NATA');
  });
});

describe('autoRoute graph reuse', () => {
  it('reads the database once per call even when every pass runs', () => {
    // No airways and no tracks: the airways pass, the direct pass and the oceanic pass all
    // run and none finds a route, so the query count is the cost of the passes alone.
    const result = autoRoute({
      departure: { latitude: 50, longitude: -14.5 },
      arrival: { latitude: 50, longitude: -41 },
      from: { latitude: 50, longitude: -14.5 },
      to: { latitude: 50, longitude: -41 },
      cruiseAltitudeFt: 35000,
    });
    expect(result).toBeNull();
    expect(navdata.waypointQueries).toBe(1);
  });
});
