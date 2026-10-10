/**
 * Renderer-side helpers for offering North Atlantic tracks: which track a route already files,
 * and whether a pair of airports crosses the track system at all.
 */
import { hasParity } from './cruiseAdjust';
import type { LatLon } from './geometry';
import { NAT_TRACK_RE, tokenizeRoute } from './routeTokens';
import type { NatFeed, NatMessageInfo, OceanicTrackInfo } from './types';

/** The track designator filed in the route ("NATA"), or null when the route has none. */
export function trackInRoute(routeText: string): string | null {
  for (const token of tokenizeRoute(routeText)) {
    const upper = token.toUpperCase();
    if (NAT_TRACK_RE.test(upper)) return upper;
  }
  return null;
}

/** The organised track system sits mid-ocean; a crossing has one end either side of this meridian. */
const NAT_MERIDIAN = -30;
/** South of this the crossing runs below the track system (Caribbean and South America). */
const NAT_MIN_LAT = 20;

export type NatDirection = 'eastbound' | 'westbound';

/**
 * Which way the flight crosses the North Atlantic, or null when it does not: both ends on the
 * same side of mid-ocean, or either end too far south for the track system to matter.
 */
export function natCrossing(departure: LatLon, arrival: LatLon): NatDirection | null {
  if (departure.latitude < NAT_MIN_LAT || arrival.latitude < NAT_MIN_LAT) return null;
  const depWest = departure.longitude < NAT_MERIDIAN;
  const arrWest = arrival.longitude < NAT_MERIDIAN;
  if (depWest === arrWest) return null;
  return depWest ? 'eastbound' : 'westbound';
}

/**
 * The message valid now, the one published for later, and the last published one, for the
 * direction flown. The feed carries the last published set only while nothing else is on.
 */
export function messagesForDirection(
  feed: NatFeed | undefined,
  direction: NatDirection
): {
  current: NatMessageInfo | null;
  upcoming: NatMessageInfo | null;
  expired: NatMessageInfo | null;
} {
  const eastbound = direction === 'eastbound';
  const mine = (feed?.messages ?? []).filter((m) => m.eastbound === eastbound);
  return {
    current: mine.find((m) => m.status === 'current') ?? null,
    upcoming: mine.find((m) => m.status === 'upcoming') ?? null,
    expired: mine.find((m) => m.status === 'expired') ?? null,
  };
}

/**
 * The tracks the router picks from on its own for the direction: the set valid now, else the
 * one published for later, else the last published one.
 */
export function offeredTracks(
  feed: NatFeed | undefined,
  direction: NatDirection
): OceanicTrackInfo[] {
  const { current, upcoming, expired } = messagesForDirection(feed, direction);
  return (current ?? upcoming ?? expired)?.tracks ?? [];
}

const FL_TO_FT = 100;

/**
 * A cruise moved onto a level the tracks offer: the suggestion itself when offered, else the
 * highest level of the right parity under it, else the lowest of the right parity, else the
 * nearest level offered at all. With no levels published the suggestion stands.
 */
export function cruiseOnTracks(
  suggestedFt: number,
  tracks: OceanicTrackInfo[],
  eastbound: boolean
): number {
  const levels = [...new Set(tracks.flatMap((t) => t.levels))]
    .map((fl) => fl * FL_TO_FT)
    .sort((a, b) => a - b);
  if (levels.length === 0 || levels.includes(suggestedFt)) return suggestedFt;
  const legal = levels.filter((ft) => hasParity(ft, eastbound));
  const legalBelow = legal.filter((ft) => ft <= suggestedFt);
  if (legalBelow.length > 0) return legalBelow[legalBelow.length - 1]!;
  if (legal.length > 0) return legal[0]!;
  const below = levels.filter((ft) => ft <= suggestedFt);
  return below.length > 0 ? below[below.length - 1]! : levels[0]!;
}

/** Whether the track publishes the cruise level; no cruise or no level list counts as a fit. */
export function cruiseFitsTrack(track: OceanicTrackInfo, cruiseFt: number | null): boolean {
  if (cruiseFt === null || track.levels.length === 0) return true;
  return track.levels.includes(Math.round(cruiseFt / 100));
}

function zulu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** "11:30–19:00Z". Times are Zulu by convention, so this is not locale-aware. */
export function validityLabel(validFrom: string, validTo: string): string {
  return `${zulu(validFrom)}–${zulu(validTo)}Z`;
}

/** The track's points as they are filed, "ETIKI 4715N 4720N ... RAFIN". */
export function trackFixString(track: OceanicTrackInfo): string {
  return track.points.map((p) => p.id).join(' ');
}
