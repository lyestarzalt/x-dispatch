/**
 * The line the map draws for a plan, built the way Little Navmap draws its route:
 * straight legs between fixes, with pre-built procedure geometry spliced in where
 * a SID/STAR/approach is chosen. Without procedures LNM's "custom" legs stand in:
 * roll down the runway and run straight out for a few miles, and join a short
 * straight final onto the arrival threshold. No fly-by arcs are ever invented.
 */
import type { RunwayEnd } from '@/types/fms';
import { type LatLon, destinationPoint, unwrapLongitude } from './geometry';
import { NAT_TRACK_RE } from './routeTokens';

/** LNM's custom departure/approach leg length when no procedure is chosen. */
const CUSTOM_LEG_NM = 3;

interface RoutePoint extends LatLon {
  via?: string;
}

export interface RunwayEnds {
  departure?: RunwayEnd;
  arrival?: RunwayEnd;
}

/** Threshold, runway end, then `climbOutNm` straight ahead (LNM: CUSTOM_DEP_RUNWAY + CUSTOM_DEP_END). */
export function takeoffPath(end: RunwayEnd, climbOutNm = CUSTOM_LEG_NM): LatLon[] {
  const threshold = { latitude: end.latitude, longitude: end.longitude };
  const farEnd = destinationPoint(threshold, end.headingDeg, end.lengthNm);
  if (climbOutNm < 0.1) return [threshold, farEnd];
  return [threshold, farEnd, destinationPoint(farEnd, end.headingDeg, climbOutNm)];
}

/** A straight final onto the threshold (LNM: CUSTOM_APP_START + CUSTOM_APP_RUNWAY). */
export function finalApproachPath(end: RunwayEnd, finalNm = CUSTOM_LEG_NM): LatLon[] {
  const threshold = { latitude: end.latitude, longitude: end.longitude };
  const reciprocal = (end.headingDeg + 180) % 360;
  return [destinationPoint(threshold, reciprocal, finalNm), threshold];
}

/** Pre-built leg geometry to draw in place of the fixes that carry its via name. */
export interface ProcedurePathHint {
  via: string;
  path: LatLon[];
  /** Which procedure it is. An approach ends on the runway; no line is drawn back to the airport. */
  kind?: 'sid' | 'star' | 'approach';
}

/** What a stretch of the drawn line is, for colouring and labelling. */
export type RouteLegKind = 'enroute' | 'track' | 'sid' | 'star' | 'approach' | 'missed';

export interface RouteLineSegment {
  kind: RouteLegKind;
  /** The procedure name for SID/STAR/approach segments, the track designator for track legs. */
  via?: string;
  /** Starts where the previous segment ended, so segments draw as one continuous line. */
  points: LatLon[];
}

/**
 * Appends points, dropping a repeat of the last one and keeping longitudes continuous: a leg
 * from 170E to 170W is drawn 20 degrees east across the antimeridian, not 340 degrees west.
 */
function appendDeduped(line: LatLon[], points: LatLon[]): void {
  for (const raw of points) {
    const last = line[line.length - 1];
    const p = last ? { ...raw, longitude: unwrapLongitude(last.longitude, raw.longitude) } : raw;
    if (
      last &&
      Math.abs(last.latitude - p.latitude) < 1e-7 &&
      Math.abs(last.longitude - p.longitude) < 1e-7
    ) {
      continue;
    }
    line.push(p);
  }
}

/**
 * The drawn line as consecutive segments, each tagged with what it is. Pre-built procedure
 * geometry becomes its own segment; everything between is plain enroute. Segments share their
 * boundary point so they render as one unbroken line.
 */
export function routeLineSegments(
  waypoints: RoutePoint[],
  ends?: RunwayEnds,
  initialClimbNm?: number,
  procedurePaths?: ProcedurePathHint[]
): RouteLineSegment[] {
  const hintByVia = new Map((procedurePaths ?? []).map((p) => [p.via, p]));
  const flysApproach = (procedurePaths ?? []).some(
    (p) => p.kind === 'approach' && p.path.length > 1
  );
  const segments: RouteLineSegment[] = [];
  const used = new Set<string>();
  let departs = false;
  let started = false;

  const lastPoint = (): LatLon | undefined => {
    const seg = segments[segments.length - 1];
    return seg?.points[seg.points.length - 1];
  };
  const push = (kind: RouteLegKind, points: LatLon[], via?: string) => {
    const current = segments[segments.length - 1];
    if (current && current.kind === kind && current.via === via) {
      appendDeduped(current.points, points);
      return;
    }
    const prev = lastPoint();
    const seg: RouteLineSegment = { kind, via, points: prev ? [prev] : [] };
    appendDeduped(seg.points, points);
    segments.push(seg);
  };

  for (const wp of waypoints) {
    if (wp.via === 'ADEP' && ends?.departure) {
      departs = true;
      continue;
    }
    // The approach geometry already ends on the runway: nothing is drawn from there back to
    // the airport datum (LNM: "Do not draw a line from runway end to airport center").
    if (wp.via === 'ADES' && flysApproach) continue;
    const hint = wp.via ? hintByVia.get(wp.via) : undefined;
    if (hint && hint.path.length > 1) {
      if (!used.has(wp.via!)) {
        used.add(wp.via!);
        const kind: RouteLegKind = hint.kind ?? 'enroute';
        if (departs && !started && ends?.departure) {
          // The SID geometry starts at the runway far end; only the roll is added, as part of it.
          push(
            kind,
            [{ latitude: ends.departure.latitude, longitude: ends.departure.longitude }],
            wp.via
          );
        }
        push(kind, hint.path, wp.via);
        started = true;
      }
      continue;
    }
    if (departs && !started && ends?.departure) {
      push('enroute', takeoffPath(ends.departure, initialClimbNm));
    }
    started = true;
    const pts =
      wp.via === 'ADES' && ends?.arrival
        ? finalApproachPath(ends.arrival)
        : [{ latitude: wp.latitude, longitude: wp.longitude }];
    // Legs flown on an oceanic track keep its designator, so the map can set them apart.
    if (wp.via && NAT_TRACK_RE.test(wp.via)) push('track', pts, wp.via);
    else push('enroute', pts);
  }
  return segments.filter((s) => s.points.length > 1 || segments.length === 1);
}

/** The whole drawn line as one point list. */
export function routeLinePoints(
  waypoints: RoutePoint[],
  ends?: RunwayEnds,
  initialClimbNm?: number,
  procedurePaths?: ProcedurePathHint[]
): LatLon[] {
  const line: LatLon[] = [];
  for (const seg of routeLineSegments(waypoints, ends, initialClimbNm, procedurePaths)) {
    appendDeduped(line, seg.points);
  }
  return line;
}
