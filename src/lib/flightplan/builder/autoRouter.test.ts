import { describe, expect, it, vi } from 'vitest';
import {
  autoRoute,
  bandAllows,
  compressPath,
  crossTrackNm,
  legCrossesArea,
  limitToFeet,
  longitudeRanges,
} from './autoRouter';
import { parseNatMessage, setOceanicTracks } from './oceanicTracks';

vi.mock('@/lib/xplaneServices/dataService/navdata/navCache', () => ({
  getAllAirwaysFromDb: () => [],
  getNavaidsInBounds: () => [],
  // One fix far from every test route, so the graph is never empty.
  getWaypointsInBounds: () => [{ id: 'ZZZZZ', areaCode: 'EG', latitude: 60, longitude: -5 }],
  getAirspacesInBounds: () => [],
}));
vi.mock('@/lib/utils/logger', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
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

describe('autoRoute with a chosen NAT track', () => {
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
    setOceanicTracks(parseNatMessage(message, far, far));
    expect(autoRoute(input)?.routeText).toContain('NATB');
  });

  it('routes through the chosen track even when another is shorter', () => {
    setOceanicTracks(parseNatMessage(message, far, far));
    const result = autoRoute({ ...input, track: 'NATA' });
    expect(result?.routeText).toContain('NATA');
    expect(result?.routeText).not.toContain('NATB');
  });
});
