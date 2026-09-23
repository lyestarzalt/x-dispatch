import { describe, expect, it, vi } from 'vitest';
import { bandAllows, compressPath, legCrossesArea, limitToFeet } from './autoRouter';

vi.mock('@/lib/xplaneServices/dataService/navdata/navCache', () => ({
  getAllAirwaysFromDb: () => [],
  getNavaidsInBounds: () => [],
  getWaypointsInBounds: () => [],
  getAirspacesInBounds: () => [],
}));

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
