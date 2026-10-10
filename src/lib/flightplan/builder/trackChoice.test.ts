import { describe, expect, it } from 'vitest';
import {
  cruiseFitsTrack,
  cruiseOnTracks,
  messagesForDirection,
  natCrossing,
  offeredTracks,
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

  it('is null when the short way round goes over the Pacific or the pole', () => {
    const ksfo = { latitude: 37.6, longitude: -122.4 };
    const vhhh = { latitude: 22.3, longitude: 113.9 };
    const panc = { latitude: 61.2, longitude: -150 };
    const rjaa = { latitude: 35.8, longitude: 140.4 };
    const uhpp = { latitude: 53.2, longitude: 158.5 };
    expect(natCrossing(ksfo, vhhh)).toBeNull();
    expect(natCrossing(panc, rjaa)).toBeNull();
    expect(natCrossing(panc, uhpp)).toBeNull();
    expect(natCrossing(rjaa, KJFK)).toBeNull();
    // Polar great circles: London to Tokyo and New York to Hong Kong never pass 30W.
    expect(natCrossing(EGLL, rjaa)).toBeNull();
    expect(natCrossing(KJFK, { latitude: 22.3, longitude: 113.9 })).toBeNull();
  });

  it('is a crossing when the short way round passes 30W, however far east it starts', () => {
    const omdb = { latitude: 25.3, longitude: 55.4 };
    expect(natCrossing(omdb, KJFK)).toBe('westbound');
    expect(natCrossing(KJFK, omdb)).toBe('eastbound');
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
    expect(east.expired).toBeNull();
  });

  it('hands over the last published set when the direction has nothing valid', () => {
    const feed: NatFeed = {
      messages: [message('expired', true, [track('V', true, [350])])],
      fetchedAt: 1,
      error: null,
    };
    const east = messagesForDirection(feed, 'eastbound');
    expect(east.current).toBeNull();
    expect(east.upcoming).toBeNull();
    expect(east.expired?.tracks.map((t) => t.id)).toEqual(['V']);
  });

  it('offers the tracks of the set the router would use: current, else upcoming, else last published', () => {
    const feed = (messages: NatMessageInfo[]): NatFeed => ({ messages, fetchedAt: 1, error: null });
    const west = (status: NatMessageStatus, id: string) =>
      message(status, false, [track(id, false, [350])]);
    expect(
      offeredTracks(
        feed([west('expired', 'A'), west('upcoming', 'B'), west('current', 'C')]),
        'westbound'
      ).map((t) => t.id)
    ).toEqual(['C']);
    expect(
      offeredTracks(feed([west('expired', 'A'), west('upcoming', 'B')]), 'westbound').map(
        (t) => t.id
      )
    ).toEqual(['B']);
    expect(offeredTracks(feed([west('expired', 'A')]), 'westbound').map((t) => t.id)).toEqual([
      'A',
    ]);
    expect(offeredTracks(feed([west('current', 'A')]), 'eastbound')).toEqual([]);
    expect(offeredTracks(undefined, 'eastbound')).toEqual([]);
  });

  it('moves a suggested cruise onto a level the tracks offer, keeping the odd-or-even rule', () => {
    const band = [340, 350, 360, 370, 380, 390, 400];
    const tracks = [track('V', true, band), track('W', true, band)];
    // FL410 is above the band: the highest odd level under it.
    expect(cruiseOnTracks(41000, tracks, true)).toBe(39000);
    // Already offered, nothing to do.
    expect(cruiseOnTracks(40000, tracks, false)).toBe(40000);
    expect(cruiseOnTracks(37000, tracks, true)).toBe(37000);
    // Below the band: the lowest level of the right parity.
    expect(cruiseOnTracks(33000, tracks, true)).toBe(35000);
    expect(cruiseOnTracks(33000, tracks, false)).toBe(34000);
    // One track with a narrow band: the nearest level it has.
    expect(cruiseOnTracks(41000, [track('X', false, [360, 380])], false)).toBe(38000);
    // No parity match at all: the highest level offered under the cruise wins.
    expect(cruiseOnTracks(41000, [track('Y', true, [360, 380])], true)).toBe(38000);
    // Nothing published: the suggestion stands.
    expect(cruiseOnTracks(41000, [], true)).toBe(41000);
    expect(cruiseOnTracks(41000, [track('Z', true, [])], true)).toBe(41000);
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
