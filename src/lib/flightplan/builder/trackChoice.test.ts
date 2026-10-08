import { describe, expect, it } from 'vitest';
import {
  cruiseFitsTrack,
  messagesForDirection,
  natCrossing,
  trackFixString,
  trackInRoute,
  validityLabel,
} from './trackChoice';
import type { NatFeed, NatMessageInfo, NatMessageStatus, OceanicTrackInfo } from './types';

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

describe('track message helpers', () => {
  const track = (id: string, eastbound: boolean, levels: number[]): OceanicTrackInfo => ({
    id,
    name: `NAT${id}`,
    eastbound,
    levels,
    validFrom: '2026-10-08T11:30:00Z',
    validTo: '2026-10-08T19:00:00Z',
    points: [
      { id: 'ETIKI', latitude: 47, longitude: -12 },
      { id: '4715N', latitude: 47, longitude: -15 },
      { id: 'RAFIN', latitude: 45, longitude: -52 },
    ],
    nars: ['N82A'],
    feederFixes: ['REGHI'],
    pbcs: false,
  });
  const message = (
    status: NatMessageStatus,
    eastbound: boolean,
    tracks: OceanicTrackInfo[]
  ): NatMessageInfo => ({
    origin: eastbound ? 'CZQX' : 'EGGX',
    eastbound,
    tmi: 281,
    validFrom: '2026-10-08T11:30:00Z',
    validTo: '2026-10-08T19:00:00Z',
    status,
    remarks: '',
    tracks,
  });

  it('splits the feed into the current and upcoming message for the direction flown', () => {
    const feed: NatFeed = {
      messages: [
        message('current', true, [track('V', true, [350])]),
        message('upcoming', false, [track('A', false, [350])]),
      ],
      fetchedAt: 1,
      error: null,
    };
    const west = messagesForDirection(feed, 'westbound');
    expect(west.current).toBeNull();
    expect(west.upcoming?.tracks.map((t) => t.id)).toEqual(['A']);
    const east = messagesForDirection(feed, 'eastbound');
    expect(east.current?.tracks.map((t) => t.id)).toEqual(['V']);
    expect(east.upcoming).toBeNull();
  });

  it('knows whether the cruise level is offered on a track', () => {
    const f = track('F', false, [350, 360, 370, 390, 400]);
    expect(cruiseFitsTrack(f, 38000)).toBe(false);
    expect(cruiseFitsTrack(f, 36000)).toBe(true);
    expect(cruiseFitsTrack(f, null)).toBe(true);
    expect(cruiseFitsTrack(track('G', false, []), 38000)).toBe(true);
  });

  it('labels the validity window in Zulu and writes the fix string as filed', () => {
    expect(validityLabel('2026-10-08T11:30:00Z', '2026-10-08T19:00:00Z')).toBe('11:30–19:00Z');
    expect(trackFixString(track('F', false, [350]))).toBe('ETIKI 4715N RAFIN');
  });
});
