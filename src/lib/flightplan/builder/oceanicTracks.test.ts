import { describe, expect, it, vi } from 'vitest';
import {
  parseNatMessage,
  resolvedTracks,
  setOceanicTracks,
  trackPoint,
  trackSegments,
  tracksFromNatJson,
} from './oceanicTracks';

vi.mock('@/lib/utils/logger', () => {
  const noop = new Proxy({}, { get: () => () => {} });
  return { default: new Proxy({}, { get: () => noop }) };
});

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
