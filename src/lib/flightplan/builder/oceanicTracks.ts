/**
 * North Atlantic organised track system. The FAA publishes the current NAT track
 * message as JSON, one entry per message part, each carrying the message text with
 * the tracks, their levels and validity. Tracks are offered to the router and the
 * resolver as one-way airways named NATA to NATZ, which is how they are filed.
 * Main process only.
 */
import logger from '@/lib/utils/logger';
import type { AirwaySegment, FixTypeNumber } from '@/types/navigation';
import { NAT_TRACK_RE } from './routeTokens';

export const NAT_JSON_URL = 'https://nms.aim.faa.gov/datanat/nat.json';
const REFRESH_MS = 30 * 60 * 1000;
const FIX_TYPE = 11 as FixTypeNumber;

export interface TrackPoint {
  id: string;
  /** NaN for a named fix, whose position comes from the database. */
  latitude: number;
  longitude: number;
}

export interface OceanicTrack {
  id: string;
  /** Filed designator, NATA. */
  name: string;
  eastbound: boolean;
  /** Flight levels available in the track direction. */
  levels: number[];
  validFrom: string;
  validTo: string;
  points: TrackPoint[];
}

interface NatPart {
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

/** Tracks in one message part: a track line is a letter, the points, then the two level lines. */
export function parseNatMessage(text: string, validFrom: string, validTo: string): OceanicTrack[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const tracks: OceanicTrack[] = [];
  for (let i = 0; i + 2 < lines.length; i++) {
    const m = /^([A-Z])\s+([A-Z0-9/]+(?:\s+[A-Z0-9/]+)+)$/.exec(lines[i]!);
    if (!m || !lines[i + 1]!.startsWith('EAST LVLS') || !lines[i + 2]!.startsWith('WEST LVLS')) {
      continue;
    }
    const east = levelsOf(lines[i + 1]!);
    const west = levelsOf(lines[i + 2]!);
    tracks.push({
      id: m[1]!,
      name: `NAT${m[1]}`,
      eastbound: east.length > 0,
      levels: east.length > 0 ? east : west,
      validFrom,
      validTo,
      points: m[2]!.split(/\s+/).map(trackPoint),
    });
  }
  return tracks;
}

/** Tracks from the FAA JSON that have not expired. */
export function tracksFromNatJson(parts: unknown, now = Date.now()): OceanicTrack[] {
  if (!Array.isArray(parts)) return [];
  const out: OceanicTrack[] = [];
  for (const part of parts as NatPart[]) {
    const text = part.condition_message;
    const from = part.start_datetime ?? '';
    const to = part.end_datetime ?? '';
    if (typeof text !== 'string' || !to || Date.parse(to) <= now) continue;
    out.push(...parseNatMessage(text, from, to));
  }
  return out;
}

let tracks: OceanicTrack[] = [];
let fetchedAt = 0;

export function setOceanicTracks(list: OceanicTrack[]): void {
  tracks = list;
  fetchedAt = Date.now();
}

export function getOceanicTracks(now = Date.now()): OceanicTrack[] {
  return tracks.filter((t) => Date.parse(t.validTo) > now);
}

/** Downloads the current message at most every half hour; a failure keeps the last tracks. */
export async function refreshOceanicTracks(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (Date.now() - fetchedAt < REFRESH_MS) return;
  fetchedAt = Date.now();
  try {
    const res = await fetchImpl(NAT_JSON_URL, { headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    tracks = tracksFromNatJson(await res.json());
    logger.main.info(`NAT tracks loaded: ${tracks.map((t) => t.id).join('') || 'none'}`);
  } catch (err) {
    logger.main.warn(`NAT tracks unavailable: ${err instanceof Error ? err.message : err}`);
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

export function isTrackName(name: string): boolean {
  return NAT_TRACK_RE.test(name.toUpperCase());
}
