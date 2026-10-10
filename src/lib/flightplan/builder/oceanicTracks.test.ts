import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type NatMessage,
  configureOceanicTracksCache,
  currentTracks,
  getOceanicTracks,
  loadOceanicTracksCache,
  parseNatFeed,
  parseNatMessage,
  refreshOceanicTracks,
  resetOceanicTracksForTests,
  resolvedFeed,
  resolvedTracks,
  setNatMessages,
  setOceanicTracks,
  trackPoint,
  trackSegments,
  tracksForAutoRouting,
  tracksFromNatJson,
} from './oceanicTracks';

const warn = vi.fn();
vi.mock('@/lib/utils/logger', () => {
  const scope = new Proxy({}, { get: (_t, k) => (k === 'warn' ? warn : () => {}) });
  return { default: new Proxy({}, { get: () => scope }) };
});

const FEED = JSON.parse(
  readFileSync(resolve(__dirname, '__fixtures__/nat-2026-10-08.json'), 'utf8')
) as unknown;
/** Eastbound set valid 01:00-08:00Z that day, westbound 11:30-19:00Z. */
const DURING_EASTBOUND = Date.parse('2026-10-08T05:00:00Z');
/** The eastbound set has ended, the westbound one is valid. */
const DURING_WESTBOUND = Date.parse('2026-10-08T12:00:00Z');

beforeEach(() => {
  resetOceanicTracksForTests();
  warn.mockClear();
});

const ids = (tracks: { id: string }[]) => tracks.map((t) => t.id).join('');

const PART_ONE = [
  'NAT-1/3 TRACKS FLS 340/400 INCLUSIVE',
  'SEP 26/0100Z TO SEP 26/0800Z',
  'PART ONE OF THREE PARTS-',
  'U ALLRY 51/50 53/40 54/30 55/20 RESNO NETKI',
  'EAST LVLS 340 350 360 370 380 390 400',
  'WEST LVLS NIL',
  'EUR RTS EAST NIL',
  'NAR N523B N507B-',
  'V ELSIR 50/50 52/40 5330/30 54/20 DOGAL BEXET',
  'EAST LVLS 340 350 360 370 380 390 400',
  'WEST LVLS NIL',
  'EUR RTS EAST NIL',
  'NAR N447B N431B-',
  'END OF PART ONE OF THREE PARTS',
].join('\r\n');

const WESTBOUND = [
  'NAT-1/2 TRACKS FLS 340/400 INCLUSIVE',
  'SEP 25/1130Z TO SEP 25/1900Z',
  'PART ONE OF TWO PARTS-',
  'A BALIX 61/20 62/30 62/40 61/50 TOXIT',
  'EAST LVLS NIL',
  'WEST LVLS 350 360 370 400',
  'EUR RTS WEST NIL',
  'NAR NIL-',
  'END OF PART ONE OF TWO PARTS',
].join('\r\n');

describe('trackPoint', () => {
  it('names whole and half degree points as the database does', () => {
    expect(trackPoint('51/50')).toEqual({ id: '5150N', latitude: 51, longitude: -50 });
    expect(trackPoint('5330/30')).toEqual({ id: 'H5330', latitude: 53.5, longitude: -30 });
    expect(trackPoint('MALOT').id).toBe('MALOT');
  });
});

describe('parseNatMessage', () => {
  it('reads tracks with their points, direction and levels', () => {
    const tracks = parseNatMessage(PART_ONE, '2026-09-26T01:00:00Z', '2026-09-26T08:00:00Z');
    expect(tracks.map((t) => t.name)).toEqual(['NATU', 'NATV']);
    const u = tracks[0]!;
    expect(u.eastbound).toBe(true);
    expect(u.levels).toEqual([340, 350, 360, 370, 380, 390, 400]);
    expect(u.points.map((p) => p.id)).toEqual([
      'ALLRY',
      '5150N',
      '5340N',
      '5430N',
      '5520N',
      'RESNO',
      'NETKI',
    ]);
    expect(tracks[1]!.points[3]!.id).toBe('H5330');
  });

  it('marks a westbound track and takes its levels from the west line', () => {
    const [a] = parseNatMessage(WESTBOUND, '', '');
    expect(a?.eastbound).toBe(false);
    expect(a?.levels).toEqual([350, 360, 370, 400]);
  });
});

describe('tracksFromNatJson', () => {
  it('keeps only parts that are still valid', () => {
    const parts = [
      {
        condition_message: PART_ONE,
        start_datetime: '2026-09-26T01:00:00Z',
        end_datetime: '2026-09-26T08:00:00Z',
      },
      {
        condition_message: WESTBOUND,
        start_datetime: '2026-09-25T11:30:00Z',
        end_datetime: '2026-09-25T19:00:00Z',
      },
    ];
    const now = Date.parse('2026-09-25T22:00:00Z');
    expect(tracksFromNatJson(parts, now).map((t) => t.id)).toEqual(['U', 'V']);
    expect(tracksFromNatJson('nonsense', now)).toEqual([]);
  });
});

describe('trackSegments', () => {
  it('turns a track into one-way segments with its level band', () => {
    const far = new Date(Date.now() + 3_600_000).toISOString();
    setOceanicTracks(parseNatMessage(PART_ONE, far, far));
    const segs = trackSegments('natu');
    expect(segs).toHaveLength(6);
    expect(segs[0]).toMatchObject({
      name: 'NATU',
      fromFix: 'ALLRY',
      toFix: '5150N',
      direction: 1,
      baseFl: 340,
      topFl: 400,
    });
    expect(trackSegments()).toHaveLength(12);
  });
});

describe('resolvedTracks', () => {
  it('gives every point a position, looking named fixes up near the track, and drops unknown ones', () => {
    const far = new Date(Date.now() + 3_600_000).toISOString();
    setOceanicTracks(parseNatMessage(PART_ONE, far, far));
    const seen: { id: string; near: { latitude: number; longitude: number } }[] = [];
    const lookup = (id: string, near: { latitude: number; longitude: number }) => {
      seen.push({ id, near });
      if (id === 'ALLRY') return { latitude: 53.5, longitude: -56 };
      if (id === 'RESNO') return { latitude: 55, longitude: -15 };
      return null;
    };
    const tracks = resolvedTracks(lookup);
    expect(tracks.map((t) => t.name)).toEqual(['NATU', 'NATV']);
    const u = tracks[0]!;
    expect(u.points.map((p) => p.id)).toEqual([
      'ALLRY',
      '5150N',
      '5340N',
      '5430N',
      '5520N',
      'RESNO',
    ]);
    expect(u.points[0]).toEqual({ id: 'ALLRY', latitude: 53.5, longitude: -56 });
    expect(u.points.every((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))).toBe(
      true
    );
    // The entry fix is searched near the first coordinate point, the exit near the last.
    expect(seen.find((s) => s.id === 'ALLRY')?.near).toEqual({ latitude: 51, longitude: -50 });
    expect(seen.find((s) => s.id === 'RESNO')?.near).toEqual({ latitude: 55, longitude: -20 });
    expect(u).toMatchObject({ eastbound: true, levels: [340, 350, 360, 370, 380, 390, 400] });
  });
});

describe('parseNatFeed', () => {
  it('reads both sets of the day with TMI, validity, status and remarks', () => {
    const messages = parseNatFeed(FEED, DURING_EASTBOUND);
    expect(messages.map((m) => [m.origin, m.eastbound, m.status, m.tmi])).toEqual([
      ['CZQX', true, 'current', 281],
      ['EGGX', false, 'upcoming', 281],
    ]);
    expect(messages[0]!.tracks.map((t) => t.id).join('')).toBe('VWXYZ');
    expect(messages[1]!.tracks.map((t) => t.id).join('')).toBe('ABCDEFG');
    expect(messages[1]).toMatchObject({
      validFrom: '2026-10-08T11:30:00Z',
      validTo: '2026-10-08T19:00:00Z',
    });
    expect(messages[1]!.remarks.startsWith('1. TMI IS 281.')).toBe(true);
    expect(messages[1]!.remarks).toContain('SLOP SHOULD BE USED');
    expect(messages[1]!.remarks).not.toContain('END OF PART');
  });

  it("keeps each track's NARs and European feeder fixes", () => {
    const [east, west] = parseNatFeed(FEED, DURING_EASTBOUND);
    const f = west!.tracks.find((t) => t.id === 'F')!;
    expect(f).toMatchObject({
      name: 'NATF',
      eastbound: false,
      levels: [350, 360, 370, 390, 400],
      feederFixes: ['REGHI'],
      nars: ['N82A', 'N94A'],
      pbcs: false,
    });
    expect(f.points.map((p) => p.id)).toEqual([
      'ETIKI',
      '4715N',
      '4720N',
      '4630N',
      '4640N',
      '4550N',
      'RAFIN',
    ]);
    const v = east!.tracks.find((t) => t.id === 'V')!;
    expect(v).toMatchObject({ feederFixes: [], nars: ['N649B', 'N635A'] });
  });

  it('keeps a set that has ended, marked as expired', () => {
    const messages = parseNatFeed(FEED, DURING_WESTBOUND);
    expect(messages.map((m) => [m.origin, m.status])).toEqual([
      ['CZQX', 'expired'],
      ['EGGX', 'current'],
    ]);
  });

  it('marks the PBCS tracks named in the remarks', () => {
    const text = [
      'NAT-1/1 TRACKS FLS 340/400 INCLUSIVE',
      'OCT 08/1130Z TO OCT 08/1900Z',
      'PART ONE OF ONE PARTS-',
      'A BALIX 60/20 62/30 PIDSO',
      'EAST LVLS NIL',
      'WEST LVLS 350 360',
      'EUR RTS WEST NIL',
      'NAR NIL-',
      'B GOMUP 59/20 61/30 SAVRY',
      'EAST LVLS NIL',
      'WEST LVLS 350 360',
      'EUR RTS WEST NIL',
      'NAR N922A-',
      'REMARKS.',
      '1. TMI IS 281.',
      '3. PBCS OTS LEVELS 350-400. PBCS TRACKS AS FOLLOWS',
      'B',
      'END OF PBCS OTS',
      'END OF PART ONE OF ONE PARTS',
    ].join('\n');
    const far = new Date(Date.now() + 3_600_000).toISOString();
    const [msg] = parseNatFeed(
      [
        {
          origin_id: 'EGGX',
          part_no: 1,
          condition_message: text,
          start_datetime: far,
          end_datetime: far,
        },
      ],
      Date.now()
    );
    expect(msg!.tracks.map((t) => [t.id, t.pbcs, t.nars])).toEqual([
      ['A', false, []],
      ['B', true, ['N922A']],
    ]);
  });
});

describe('track availability', () => {
  it('offers every unexpired track to the resolver but only valid ones as current', () => {
    setNatMessages(parseNatFeed(FEED, DURING_EASTBOUND));
    expect(
      getOceanicTracks(DURING_EASTBOUND)
        .map((t) => t.id)
        .join('')
    ).toBe('VWXYZABCDEFG');
    expect(
      currentTracks(DURING_EASTBOUND)
        .map((t) => t.id)
        .join('')
    ).toBe('VWXYZ');
  });
});

describe('last published set', () => {
  it('offers the ended set for a direction with nothing valid, as a suggestion', () => {
    setNatMessages(parseNatFeed(FEED, DURING_EASTBOUND));
    expect(ids(currentTracks(DURING_WESTBOUND))).toBe('ABCDEFG');
    // The router falls back to it, the resolver accepts a typed designator from it.
    expect(ids(tracksForAutoRouting(DURING_WESTBOUND))).toBe('VWXYZABCDEFG');
    expect(ids(getOceanicTracks(DURING_WESTBOUND))).toBe('VWXYZABCDEFG');
    const feed = resolvedFeed(() => null, DURING_WESTBOUND);
    expect(feed.messages.map((m) => [m.origin, m.status])).toEqual([
      ['CZQX', 'expired'],
      ['EGGX', 'current'],
    ]);
  });

  it('drops the ended set once a new one for its direction is published', () => {
    const [east, west] = parseNatFeed(FEED, DURING_EASTBOUND) as [NatMessage, NatMessage];
    const next: NatMessage = {
      ...east,
      validFrom: '2026-10-09T01:00:00Z',
      validTo: '2026-10-09T08:00:00Z',
      status: 'upcoming',
    };
    setNatMessages([east, west, next]);
    const now = Date.parse('2026-10-08T14:00:00Z');
    expect(resolvedFeed(() => null, now).messages.map((m) => [m.origin, m.status])).toEqual([
      ['EGGX', 'current'],
      ['CZQX', 'upcoming'],
    ]);
    expect(ids(tracksForAutoRouting(now))).toBe('VWXYZABCDEFG');
  });

  it('forgets an ended set after two days', () => {
    setNatMessages(parseNatFeed(FEED, DURING_EASTBOUND));
    const later = Date.parse('2026-10-10T20:00:00Z');
    expect(resolvedFeed(() => null, later).messages).toEqual([]);
    expect(tracksForAutoRouting(later)).toEqual([]);
  });

  it('keeps the ended set when the live feed no longer carries it', async () => {
    setNatMessages(parseNatFeed(FEED, DURING_EASTBOUND));
    const westOnly = (FEED as { origin_id: string }[]).filter((p) => p.origin_id === 'EGGXZOZX');
    const live: typeof fetch = async () =>
      new Response(JSON.stringify(westOnly), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await refreshOceanicTracks(live, { force: true, now: DURING_WESTBOUND });
    const feed = resolvedFeed(() => null, DURING_WESTBOUND);
    expect(feed.messages.map((m) => [m.origin, m.status])).toEqual([
      ['CZQX', 'expired'],
      ['EGGX', 'current'],
    ]);
  });
});

describe('track cache', () => {
  it('saves the feed after a download and loads it back on start', async () => {
    const file = join(mkdtempSync(join(tmpdir(), 'nat-')), 'nat-tracks.json');
    configureOceanicTracksCache(file);
    const ok: typeof fetch = async () =>
      new Response(JSON.stringify(FEED), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await refreshOceanicTracks(ok, { force: true, now: DURING_EASTBOUND });
    expect(existsSync(file)).toBe(true);

    resetOceanicTracksForTests();
    configureOceanicTracksCache(file);
    expect(resolvedFeed(() => null, DURING_WESTBOUND).messages).toEqual([]);
    loadOceanicTracksCache(DURING_WESTBOUND);
    expect(resolvedFeed(() => null, DURING_WESTBOUND).messages.map((m) => m.origin)).toEqual([
      'CZQX',
      'EGGX',
    ]);
  });

  it('ignores a missing or broken cache file', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'nat-')), 'nat-tracks.json');
    configureOceanicTracksCache(file);
    expect(() => loadOceanicTracksCache()).not.toThrow();
    writeFileSync(file, '{not json');
    expect(() => loadOceanicTracksCache()).not.toThrow();
    expect(resolvedFeed(() => null).messages).toEqual([]);
  });
});

describe('refreshOceanicTracks', () => {
  it('times out, logs the elapsed time and reason, and keeps the previous feed', async () => {
    setNatMessages(parseNatFeed(FEED, DURING_EASTBOUND));
    const hanging: typeof fetch = (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
    await refreshOceanicTracks(hanging, { timeoutMs: 20, force: true });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toMatch(/NAT tracks unavailable after \d+ms: /);
    const feed = resolvedFeed(() => null, DURING_EASTBOUND);
    expect(feed.messages).toHaveLength(2);
    expect(feed.error).toMatch(/abort|timeout/i);
  });

  it('replaces the feed on success and clears the error', async () => {
    const ok: typeof fetch = async () =>
      new Response(JSON.stringify(FEED), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    await refreshOceanicTracks(ok, { force: true, now: DURING_EASTBOUND });
    const feed = resolvedFeed(() => null, DURING_EASTBOUND);
    expect(feed.messages.map((m) => m.origin)).toEqual(['CZQX', 'EGGX']);
    expect(feed.error).toBeNull();
    expect(feed.fetchedAt).not.toBeNull();
  });
});

describe('resolvedFeed', () => {
  it('returns the messages with placed track points and the fetch state', () => {
    setNatMessages(parseNatFeed(FEED, DURING_EASTBOUND));
    const feed = resolvedFeed(
      (id) => (id === 'ETIKI' ? { latitude: 47, longitude: -12 } : null),
      DURING_EASTBOUND
    );
    const f = feed.messages[1]!.tracks.find((t) => t.id === 'F')!;
    // RAFIN is unknown to the lookup and dropped; ETIKI is placed.
    expect(f.points.map((p) => p.id)).toEqual([
      'ETIKI',
      '4715N',
      '4720N',
      '4630N',
      '4640N',
      '4550N',
    ]);
    expect(f.points[0]).toEqual({ id: 'ETIKI', latitude: 47, longitude: -12 });
    expect(f.nars).toEqual(['N82A', 'N94A']);
    expect(feed.messages[1]!.status).toBe('upcoming');
  });
});
