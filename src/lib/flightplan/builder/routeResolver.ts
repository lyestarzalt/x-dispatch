/**
 * Turns a plan draft into FMS waypoints using the navigation database. Main
 * process only: the database lives there. Each ident is resolved nearest to
 * the previous point so duplicated fix names pick the one on the way, and
 * airways are walked segment by segment between the fixes either side.
 */
import {
  getAirwaysByName,
  getNavaidEnrichedById,
  getWaypointNearestById,
} from '@/lib/xplaneServices/dataService/navdata/navCache';
import type { FMSFlightPlan, FMSWaypoint, FMSWaypointType } from '@/types/fms';
import type { AirwaySegment } from '@/types/navigation';
import { narrowBand, pairBand, segmentAllowsDirection, segmentsForPair } from './airwayRules';
import { type LatLon, pathDistanceNm } from './geometry';
import { getOceanicTracks, isTrackName, trackSegments } from './oceanicTracks';
import { type LexedToken, lexRoute, stripEndpoints } from './routeTokens';
import type { LevelBand, PlanDraft, RouteResolution, RouteToken } from './types';

/** Idents are looked up within this radius of the previous point; legs longer than this are rare. */
const SEARCH_RADIUS_NM = 1500;
/** Airway walks longer than this are almost certainly the wrong direction round a loop. */
const MAX_AIRWAY_HOPS = 80;

interface ResolvedPoint {
  id: string;
  type: FMSWaypointType;
  latitude: number;
  longitude: number;
}

function resolveIdent(ident: string, near: LatLon): ResolvedPoint | null {
  const asFix = (): ResolvedPoint | null => {
    const wp = getWaypointNearestById(ident, near.latitude, near.longitude, SEARCH_RADIUS_NM);
    return wp ? { id: wp.id, type: 11, latitude: wp.latitude, longitude: wp.longitude } : null;
  };
  const asNavaid = (): ResolvedPoint | null => {
    const nav = getNavaidEnrichedById(ident, near.latitude, near.longitude, SEARCH_RADIUS_NM);
    if (!nav) return null;
    const type: FMSWaypointType = nav.type.toUpperCase().includes('NDB') ? 2 : 3;
    return { id: nav.id, type, latitude: nav.latitude, longitude: nav.longitude };
  };
  // Short idents are usually navaids, five letters are fixes; try the likely one first.
  return ident.length <= 3 ? (asNavaid() ?? asFix()) : (asFix() ?? asNavaid());
}

/** Published airways from the database; NAT tracks from the current track message. */
function airwaySegments(name: string): AirwaySegment[] {
  return isTrackName(name) ? trackSegments(name) : getAirwaysByName(name);
}

/** Fix ids strictly between `from` and `to` along the airway, or null when they are not joined. */
function walkAirway(name: string, from: string, to: string): string[] | null {
  const segments = airwaySegments(name);
  if (segments.length === 0) return null;
  const adjacency = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!adjacency.has(a)) adjacency.set(a, new Set());
    adjacency.get(a)!.add(b);
  };
  for (const s of segments) {
    link(s.fromFix, s.toFix);
    link(s.toFix, s.fromFix);
  }
  if (!adjacency.has(from) || !adjacency.has(to)) return null;

  const previous = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === to) break;
    for (const next of adjacency.get(current) ?? []) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  if (!previous.has(to)) return null;

  const path: string[] = [];
  let cursor: string | null = to;
  while (cursor !== null && cursor !== from) {
    path.unshift(cursor);
    cursor = previous.get(cursor) ?? null;
    if (path.length > MAX_AIRWAY_HOPS) return null;
  }
  return path.slice(0, -1);
}

/** A track designator stands for the whole track; filed between other points it is flagged. */
function flagPartialTrack(
  pending: { token: RouteToken; name: string; entryId: string },
  exitId: string
): void {
  if (!isTrackName(pending.name)) return;
  const track = getOceanicTracks().find((t) => t.name === pending.name.toUpperCase());
  if (!track || track.points.length === 0) return;
  const first = track.points[0]!.id;
  const last = track.points[track.points.length - 1]!.id;
  if (first === pending.entryId && last === exitId) return;
  pending.token.status = 'warning';
  pending.token.issue = 'trackPartial';
}

/**
 * Checks each pair of fixes walked along an airway against its stored segments: the
 * direction they may be flown and the level band they are published for. The first
 * failing pair marks the token; a wrong direction outranks a wrong level. Returns the band
 * the whole walk allows. Tracks carry their own levels and are checked by the track picker.
 */
function checkAirway(
  token: RouteToken,
  name: string,
  path: string[],
  cruiseFt: number | null
): LevelBand {
  let band: LevelBand = { minFt: null, maxFt: null };
  if (isTrackName(name)) return band;
  const segments = airwaySegments(name);
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1]!;
    const to = path[i]!;
    const stored = segmentsForPair(segments, from, to);
    const flyable = stored.filter((s) => segmentAllowsDirection(s, from, to));
    if (stored.length > 0 && flyable.length === 0) {
      token.status = 'warning';
      token.issue = 'airwayWrongWay';
      delete token.levels;
      return band;
    }
    const pair = pairBand(flyable);
    band = narrowBand(band, pair);
    const below = pair.minFt !== null && cruiseFt !== null && cruiseFt < pair.minFt;
    const above = pair.maxFt !== null && cruiseFt !== null && cruiseFt > pair.maxFt;
    if ((below || above) && token.status === 'ok') {
      token.status = 'warning';
      token.issue = 'airwayLevel';
      token.levels = pair;
    }
  }
  return band;
}

export function resolveRoute(draft: PlanDraft, cycle?: string): RouteResolution | null {
  const { departure, arrival } = draft;
  if (!departure || !arrival) return null;

  const cruise = draft.cruiseAltitudeFt ?? 0;
  const waypoints: FMSWaypoint[] = [
    {
      type: 1,
      id: departure.icao,
      via: 'ADEP',
      altitude: 0,
      latitude: departure.latitude,
      longitude: departure.longitude,
    },
  ];
  const tokens: RouteToken[] = [];
  let cursor: LatLon = departure;
  let lastFixId: string | null = null;
  let levels: LevelBand = { minFt: null, maxFt: null };
  const levelSetters: RouteResolution['levelSetters'] = {};
  let pendingAirway: { token: RouteToken; name: string; entryId: string } | null = null;

  const push = (point: ResolvedPoint, via: string) => {
    waypoints.push({ ...point, via, altitude: cruise });
    cursor = point;
    lastFixId = point.id;
  };
  const failAirway = (issue: RouteToken['issue']) => {
    if (!pendingAirway) return;
    pendingAirway.token.status = 'invalid';
    pendingAirway.token.issue = issue;
    pendingAirway = null;
  };

  const lexed: LexedToken[] = stripEndpoints(
    lexRoute(draft.routeText),
    departure.icao,
    arrival.icao
  );

  for (const lexedToken of lexed) {
    if (lexedToken.kind === 'direct') {
      tokens.push({ text: lexedToken.text, kind: 'direct', status: 'ok' });
      failAirway('airwayNoFixAfter');
      continue;
    }

    if (lexedToken.kind === 'latlon' && lexedToken.latLon) {
      tokens.push({ text: lexedToken.text, kind: 'latlon', status: 'ok' });
      failAirway('airwayEndsAtCoordinate');
      push({ id: lexedToken.text, type: 28, ...lexedToken.latLon }, 'DRCT');
      continue;
    }

    if (lexedToken.kind === 'airway') {
      const token: RouteToken = { text: lexedToken.text, kind: 'airway', status: 'ok' };
      tokens.push(token);
      if (airwaySegments(lexedToken.text).length === 0) {
        // Not an airway after all: some fixes carry digits. Try it as a point.
        const point = resolveIdent(lexedToken.text, cursor);
        if (point) {
          token.kind = point.type === 11 ? 'fix' : 'navaid';
          push(point, 'DRCT');
        } else {
          token.status = 'unknown';
          token.issue = 'notFound';
        }
        continue;
      }
      if (!lastFixId) {
        token.status = 'invalid';
        token.issue = 'airwayNoFixBefore';
        continue;
      }
      pendingAirway = { token, name: lexedToken.text, entryId: lastFixId };
      continue;
    }

    // Along an airway the fixes are resolved one after another, so the search follows the
    // airway and a long one, or an oceanic track, still finds its exit far from the entry.
    const between =
      pendingAirway && lastFixId
        ? walkAirway(pendingAirway.name, lastFixId, lexedToken.text)
        : null;
    const entryId = lastFixId;
    if (between) {
      const via = pendingAirway!.name;
      for (const midId of between) {
        const mid = resolveIdent(midId, cursor);
        if (mid) push(mid, via);
      }
    }

    const point = resolveIdent(lexedToken.text, cursor);
    const token: RouteToken = {
      text: lexedToken.text,
      kind: point ? (point.type === 11 ? 'fix' : 'navaid') : 'fix',
      status: point ? 'ok' : 'unknown',
    };
    tokens.push(token);
    if (!point) {
      token.issue = 'notFound';
      failAirway('airwayExitUnknown');
      continue;
    }

    if (pendingAirway) {
      if (between === null) {
        failAirway('airwayNotJoined');
        push(point, 'DRCT');
      } else {
        push(point, pendingAirway.name);
        flagPartialTrack(pendingAirway, point.id);
        const walked = [entryId!, ...between, point.id];
        const band = checkAirway(
          pendingAirway.token,
          pendingAirway.name,
          walked,
          draft.cruiseAltitudeFt
        );
        if (band.minFt !== null && (levels.minFt === null || band.minFt > levels.minFt)) {
          levelSetters.floor = pendingAirway.name;
        }
        if (band.maxFt !== null && (levels.maxFt === null || band.maxFt < levels.maxFt)) {
          levelSetters.ceiling = pendingAirway.name;
        }
        levels = narrowBand(levels, band);
        pendingAirway = null;
      }
      continue;
    }

    push(point, 'DRCT');
  }

  failAirway('airwayNoFixAfter');

  waypoints.push({
    type: 1,
    id: arrival.icao,
    via: 'ADES',
    altitude: 0,
    latitude: arrival.latitude,
    longitude: arrival.longitude,
  });

  const plan: FMSFlightPlan = {
    version: 1100,
    cycle,
    departure: { icao: departure.icao, runway: departure.runway },
    arrival: { icao: arrival.icao, runway: arrival.runway },
    waypoints,
  };

  return { plan, tokens, distanceNm: pathDistanceNm(waypoints), levels, levelSetters };
}
