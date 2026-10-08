/**
 * North Atlantic organised track system. The FAA publishes the current NAT track
 * messages as JSON, one entry per message part. Each message covers one direction and one
 * validity window and lists its tracks with their levels, the North American Routes and
 * European feeder fixes that go with them, and remarks carrying the TMI and PBCS tracks.
 * Tracks are offered to the router and the resolver as one-way airways named NATA to
 * NATZ, which is how they are filed. Main process only.
 */
import logger from '@/lib/utils/logger';
import type { AirwaySegment, FixTypeNumber } from '@/types/navigation';
import type { LatLon } from './geometry';
import { NAT_TRACK_RE } from './routeTokens';
import type { NatFeed, NatMessageInfo, NatMessageStatus, OceanicTrackInfo } from './types';

export const NAT_JSON_URL = 'https://nms.aim.faa.gov/datanat/nat.json';
const REFRESH_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15_000;
const FIX_TYPE = 11 as FixTypeNumber;

export interface TrackPoint {
  id: string;
  /** NaN for a named fix, whose position comes from the database. */
  latitude: number;
  longitude: number;
}

/** A parsed track; named points are placed later by `resolvedFeed`. */
export interface OceanicTrack extends Omit<OceanicTrackInfo, 'points'> {
  points: TrackPoint[];
}

/** A parsed message; `status` is as of the time it was parsed and is recomputed on read. */
export interface NatMessage extends Omit<NatMessageInfo, 'tracks'> {
  tracks: OceanicTrack[];
}

interface NatPart {
  origin_id?: string;
  part_no?: number;
  condition_message?: string;
  start_datetime?: string;
  end_datetime?: string;
}

/**
 * "51/50" is 51N 050W, named 5150N in the database; "5130/50" is the half-degree point
 * 51°30'N 050W, named H5150. Anything else is a named fix.
 */
export function trackPoint(token: string): TrackPoint {
  const m = /^(\d{2})(\d{2})?\/(\d{2,3})$/.exec(token);
  if (!m) return { id: token, latitude: NaN, longitude: NaN };
  const lat = Number(m[1]);
  const min = Number(m[2] ?? '0');
  const lon = Number(m[3]);
  const lonPart = m[3]!.slice(-2);
  const id = min === 0 ? `${m[1]}${lonPart}N` : `H${m[1]}${lonPart}`;
  return { id, latitude: lat + min / 60, longitude: -lon };
}

function levelsOf(line: string): number[] {
  return (line.replace(/^(EAST|WEST) LVLS/, '').match(/\d{3}/g) ?? []).map(Number);
}

/** The idents after a keyword line, with NIL and a trailing dash dropped. */
function identsOf(line: string, prefix: RegExp): string[] {
  return line
    .replace(prefix, '')
    .replace(/-$/, '')
    .split(/\s+/)
    .filter((t) => t !== '' && t !== 'NIL');
}

interface ParsedText {
  tracks: OceanicTrack[];
  tmi: number | null;
  remarks: string;
}

/**
 * Tracks in one message text: a track line is a letter, the points, then the two level
 * lines, then optionally the EUR RTS and NAR lines. The remarks block, when present, names
 * the TMI and the PBCS tracks.
 */
function parseNatText(text: string, validFrom: string, validTo: string): ParsedText {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tracks: OceanicTrack[] = [];
  let remarksAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^REMARKS/.test(lines[i]!)) {
      remarksAt = i;
      break;
    }
    if (i + 2 >= lines.length) break;
    const m = /^([A-Z])\s+([A-Z0-9/]+(?:\s+[A-Z0-9/]+)+)$/.exec(lines[i]!);
    if (!m || !lines[i + 1]!.startsWith('EAST LVLS') || !lines[i + 2]!.startsWith('WEST LVLS')) {
      continue;
    }
    const east = levelsOf(lines[i + 1]!);
    const west = levelsOf(lines[i + 2]!);
    const eastbound = east.length > 0;
    let feederFixes: string[] = [];
    let nars: string[] = [];
    for (let j = i + 3; j < lines.length; j++) {
      const line = lines[j]!;
      if (/^EUR RTS/.test(line)) {
        const fixes = identsOf(line, /^EUR RTS (EAST|WEST)/);
        // The message carries the line for the message's direction; the other reads NIL.
        if (line.startsWith(eastbound ? 'EUR RTS EAST' : 'EUR RTS WEST')) feederFixes = fixes;
      } else if (/^NAR\b/.test(line)) {
        nars = identsOf(line, /^NAR/);
      } else {
        break;
      }
    }
    tracks.push({
      id: m[1]!,
      name: `NAT${m[1]}`,
      eastbound,
      levels: eastbound ? east : west,
      validFrom,
      validTo,
      points: m[2]!.split(/\s+/).map(trackPoint),
      nars,
      feederFixes,
      pbcs: false,
    });
  }

  let tmi: number | null = null;
  let remarks = '';
  if (remarksAt >= 0) {
    const body: string[] = [];
    for (let i = remarksAt + 1; i < lines.length; i++) {
      if (lines[i]!.startsWith('END OF PART')) break;
      body.push(lines[i]!);
    }
    remarks = body.join('\n');
    const tmiMatch = /TMI IS (\d+)/.exec(remarks);
    tmi = tmiMatch ? Number(tmiMatch[1]) : null;
    const pbcs = new Set<string>();
    const start = body.findIndex((l) => l.includes('PBCS TRACKS AS FOLLOWS'));
    if (start >= 0) {
      for (let i = start + 1; i < body.length; i++) {
        const line = body[i]!;
        if (line.startsWith('END OF PBCS')) break;
        if (/NO ASSIGNED/.test(line)) continue;
        for (const token of line.split(/[\s,]+/)) if (/^[A-Z]$/.test(token)) pbcs.add(token);
      }
    }
    for (const track of tracks) track.pbcs = pbcs.has(track.id);
  }
  return { tracks, tmi, remarks };
}

/** Tracks in one message part (kept for callers that only need the tracks). */
export function parseNatMessage(text: string, validFrom: string, validTo: string): OceanicTrack[] {
  return parseNatText(text, validFrom, validTo).tracks;
}

/**
 * Every message in the FAA JSON that has not expired, parts joined, oldest first. A
 * message is one origin and one validity window.
 */
export function parseNatFeed(parts: unknown, now = Date.now()): NatMessage[] {
  if (!Array.isArray(parts)) return [];
  const groups = new Map<string, NatPart[]>();
  for (const part of parts as NatPart[]) {
    if (typeof part?.condition_message !== 'string' || !part.end_datetime) continue;
    if (Date.parse(part.end_datetime) <= now) continue;
    const key = `${part.origin_id ?? ''}|${part.start_datetime ?? ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(part);
  }
  const out: NatMessage[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => (a.part_no ?? 0) - (b.part_no ?? 0));
    const first = group[0]!;
    const validFrom = first.start_datetime ?? '';
    const validTo = first.end_datetime ?? '';
    const text = group.map((p) => p.condition_message).join('\n');
    const parsed = parseNatText(text, validFrom, validTo);
    if (parsed.tracks.length === 0) continue;
    out.push({
      origin: (first.origin_id ?? '').replace(/ZOZX$|ZQZX$/, ''),
      eastbound: parsed.tracks[0]!.eastbound,
      tmi: parsed.tmi,
      validFrom,
      validTo,
      status: messageStatus({ validFrom, validTo }, now),
      remarks: parsed.remarks,
      tracks: parsed.tracks,
    });
  }
  out.sort((a, b) => Date.parse(a.validFrom) - Date.parse(b.validFrom));
  return out;
}

/** Tracks from the FAA JSON that have not expired. */
export function tracksFromNatJson(parts: unknown, now = Date.now()): OceanicTrack[] {
  return parseNatFeed(parts, now).flatMap((m) => m.tracks);
}

let messages: NatMessage[] = [];
let fetchedAt: number | null = null;
let lastAttempt = 0;
let lastError: string | null = null;

export function setNatMessages(list: NatMessage[]): void {
  messages = list;
  fetchedAt = Date.now();
  lastAttempt = fetchedAt;
  lastError = null;
}

/** Tracks alone, wrapped in one message per direction (tests and callers without a feed). */
export function setOceanicTracks(list: OceanicTrack[]): void {
  const byDirection = new Map<boolean, OceanicTrack[]>();
  for (const t of list) {
    if (!byDirection.has(t.eastbound)) byDirection.set(t.eastbound, []);
    byDirection.get(t.eastbound)!.push(t);
  }
  setNatMessages(
    [...byDirection.entries()].map(([eastbound, tracks]) => ({
      origin: '',
      eastbound,
      tmi: null,
      validFrom: tracks[0]!.validFrom,
      validTo: tracks[0]!.validTo,
      status: messageStatus(tracks[0]!, Date.now()),
      remarks: '',
      tracks,
    }))
  );
}

export function resetOceanicTracksForTests(): void {
  messages = [];
  fetchedAt = null;
  lastAttempt = 0;
  lastError = null;
}

export function messageStatus(
  msg: { validFrom: string; validTo: string },
  now: number
): NatMessageStatus {
  return Date.parse(msg.validFrom) > now ? 'upcoming' : 'current';
}

function unexpired(now: number): NatMessage[] {
  return messages.filter((m) => Date.parse(m.validTo) > now);
}

/** Every published track that has not expired, upcoming ones included, for the resolver. */
export function getOceanicTracks(now = Date.now()): OceanicTrack[] {
  return unexpired(now).flatMap((m) => m.tracks);
}

/** Only the tracks valid right now, for the router's own choice. */
export function currentTracks(now = Date.now()): OceanicTrack[] {
  return unexpired(now)
    .filter((m) => messageStatus(m, now) === 'current')
    .flatMap((m) => m.tracks);
}

/**
 * The tracks the router may pick on its own: per direction the set valid now, or, while no
 * set for that direction is valid yet, the one published for later. A flight planned before
 * the day's westbound set starts still gets a westbound track.
 */
export function tracksForAutoRouting(now = Date.now()): OceanicTrack[] {
  const out: OceanicTrack[] = [];
  for (const eastbound of [true, false]) {
    const mine = unexpired(now).filter((m) => m.eastbound === eastbound);
    const current = mine.filter((m) => messageStatus(m, now) === 'current');
    const pick = current.length > 0 ? current : mine;
    out.push(...pick.flatMap((m) => m.tracks));
  }
  return out;
}

interface RefreshOptions {
  timeoutMs?: number;
  /** Download even if the last attempt was recent. */
  force?: boolean;
  now?: number;
}

/**
 * Downloads the current messages at most every half hour, with a hard timeout; a failure
 * keeps the last feed and records why.
 */
export async function refreshOceanicTracks(
  fetchImpl: typeof fetch = fetch,
  opts: RefreshOptions = {}
): Promise<void> {
  const now = opts.now ?? Date.now();
  if (!opts.force && now - lastAttempt < REFRESH_MS) return;
  lastAttempt = now;
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? FETCH_TIMEOUT_MS);
  try {
    const res = await fetchImpl(NAT_JSON_URL, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    messages = parseNatFeed(await res.json(), now);
    fetchedAt = Date.now();
    lastError = null;
    logger.main.info(
      `NAT tracks loaded: ${messages.map((m) => `${m.origin} ${m.tracks.map((t) => t.id).join('')}`).join(', ') || 'none'}`
    );
  } catch (err) {
    const reason = controller.signal.aborted
      ? 'timeout'
      : err instanceof Error
        ? err.message
        : String(err);
    lastError = reason;
    logger.main.warn(`NAT tracks unavailable after ${Date.now() - startedAt}ms: ${reason}`);
  } finally {
    clearTimeout(timer);
  }
}

/** Track legs as one-way airway segments, for the resolver's airway walk. */
export function trackSegments(name?: string): AirwaySegment[] {
  const out: AirwaySegment[] = [];
  for (const track of getOceanicTracks()) {
    if (name && track.name !== name.toUpperCase()) continue;
    const base = Math.min(...track.levels);
    const top = Math.max(...track.levels);
    for (let i = 0; i + 1 < track.points.length; i++) {
      out.push({
        name: track.name,
        fromFix: track.points[i]!.id,
        fromRegion: 'NAT',
        fromNavaidType: FIX_TYPE,
        toFix: track.points[i + 1]!.id,
        toRegion: 'NAT',
        toNavaidType: FIX_TYPE,
        isHigh: true,
        direction: 1,
        baseFl: Number.isFinite(base) ? base : 0,
        topFl: Number.isFinite(top) ? top : 0,
      });
    }
  }
  return out;
}

type Lookup = (id: string, near: LatLon) => LatLon | null;

/**
 * A track with every point placed: lat/lon points carry their own position, named fixes
 * are looked up near the closest coordinate point on the track. Points the lookup cannot
 * place are dropped, so the renderer can draw the track as one line. Null when fewer than
 * two points remain.
 */
function placeTrack(track: OceanicTrack, lookup: Lookup): OceanicTrackInfo | null {
  const placed = track.points.filter((p) => Number.isFinite(p.latitude));
  const points: OceanicTrackInfo['points'] = [];
  for (let i = 0; i < track.points.length; i++) {
    const p = track.points[i]!;
    if (Number.isFinite(p.latitude)) {
      points.push({ id: p.id, latitude: p.latitude, longitude: p.longitude });
      continue;
    }
    // Nearest placed point along the track: the first one after an entry fix, the last one
    // before an exit fix.
    const after = track.points.slice(i + 1).find((q) => Number.isFinite(q.latitude));
    const before = [...track.points.slice(0, i)].reverse().find((q) => Number.isFinite(q.latitude));
    const near = after ?? before ?? placed[0];
    if (!near) continue;
    const pos = lookup(p.id, { latitude: near.latitude, longitude: near.longitude });
    if (pos) points.push({ id: p.id, latitude: pos.latitude, longitude: pos.longitude });
  }
  if (points.length < 2) return null;
  return { ...track, points };
}

/** The unexpired tracks with every point placed, flat (kept for callers without a feed). */
export function resolvedTracks(lookup: Lookup, now = Date.now()): OceanicTrackInfo[] {
  const out: OceanicTrackInfo[] = [];
  for (const track of getOceanicTracks(now)) {
    const placed = placeTrack(track, lookup);
    if (placed) out.push(placed);
  }
  return out;
}

/** The unexpired messages with placed tracks and the state of the last download. */
export function resolvedFeed(lookup: Lookup, now = Date.now()): NatFeed {
  const out: NatMessageInfo[] = [];
  for (const msg of unexpired(now)) {
    const tracks: OceanicTrackInfo[] = [];
    for (const track of msg.tracks) {
      const placed = placeTrack(track, lookup);
      if (placed) tracks.push(placed);
    }
    out.push({ ...msg, status: messageStatus(msg, now), tracks });
  }
  return { messages: out, fetchedAt, error: lastError };
}

export function isTrackName(name: string): boolean {
  return NAT_TRACK_RE.test(name.toUpperCase());
}
