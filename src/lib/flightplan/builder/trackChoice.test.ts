import { describe, expect, it } from 'vitest';
import { natCrossing, trackInRoute } from './trackChoice';

describe('trackInRoute', () => {
  it('finds the NAT designator filed in the route', () => {
    expect(trackInRoute('MALOT NATA 5250N DCT YQX')).toBe('NATA');
    expect(trackInRoute('malot natb 5250n')).toBe('NATB');
  });

  it('is null without a track', () => {
    expect(trackInRoute('SUGOL UL620 KEKIX')).toBeNull();
    expect(trackInRoute('')).toBeNull();
  });
});

describe('natCrossing', () => {
  const EIDW = { latitude: 53.4, longitude: -6.3 };
  const KJFK = { latitude: 40.6, longitude: -73.8 };
  const EGLL = { latitude: 51.5, longitude: -0.5 };
  const LFPG = { latitude: 49, longitude: 2.5 };
  const SBGR = { latitude: -23.4, longitude: -46.5 };

  it('is westbound from Europe to North America and eastbound the other way', () => {
    expect(natCrossing(EIDW, KJFK)).toBe('westbound');
    expect(natCrossing(KJFK, EIDW)).toBe('eastbound');
  });

  it('is null when both ends sit on the same side of the Atlantic', () => {
    expect(natCrossing(EGLL, LFPG)).toBeNull();
  });

  it('is null for a crossing well south of the track system', () => {
    expect(natCrossing(LFPG, SBGR)).toBeNull();
  });
});
