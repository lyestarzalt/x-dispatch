/**
 * The line the map draws for a plan, built the way a departure is actually
 * flown: roll down the runway, climb straight ahead, then one turn of fixed
 * radius that ends tangent to the direct leg for the first fix. Between fixes
 * the turns are fly-by arcs; the arrival joins a straight final onto the
 * threshold. Without a runway the airport datum stands in, as before.
 */
import type { RunwayEnd } from '@/types/fms';
import { type LatLon, destinationPoint, smoothRoutePath } from './geometry';

/** Straight-ahead climb after the runway end before the first turn. */
const CLIMB_OUT_NM = 2;
/** Length of the straight final onto the threshold. */
const FINAL_NM = 6;
/** Turn radius after take-off, at climb speed. */
const TERMINAL_TURN_RADIUS_NM = 2;
/** Fly-by radius between enroute fixes. */
const ENROUTE_TURN_RADIUS_NM = 3;
const ARC_STEP_RAD = (10 * Math.PI) / 180;
const NM_PER_DEG_LAT = 60;

interface RoutePoint extends LatLon {
  via?: string;
}

export interface RunwayEnds {
  departure?: RunwayEnd;
  arrival?: RunwayEnd;
}

export function takeoffPath(end: RunwayEnd, climbOutNm = CLIMB_OUT_NM): LatLon[] {
  const threshold = { latitude: end.latitude, longitude: end.longitude };
  const farEnd = destinationPoint(threshold, end.headingDeg, end.lengthNm);
  if (climbOutNm < 0.1) return [threshold, farEnd];
  return [threshold, farEnd, destinationPoint(farEnd, end.headingDeg, climbOutNm)];
}

/** Distance flown along `headingDeg` from `from` before `to` is abeam; negative when behind. */
function alongTrackNm(from: LatLon, headingDeg: number, to: LatLon): number {
  const kx = NM_PER_DEG_LAT * Math.cos((from.latitude * Math.PI) / 180);
  const dx = (to.longitude - from.longitude) * kx;
  const dy = (to.latitude - from.latitude) * NM_PER_DEG_LAT;
  const h = (headingDeg * Math.PI) / 180;
  return dx * Math.sin(h) + dy * Math.cos(h);
}

export function finalApproachPath(end: RunwayEnd): LatLon[] {
  const threshold = { latitude: end.latitude, longitude: end.longitude };
  const reciprocal = (end.headingDeg + 180) % 360;
  return [destinationPoint(threshold, reciprocal, FINAL_NM), threshold];
}

/**
 * Arc from `from`, flying `trackDeg`, onto the tangent that leads straight to
 * `fix`. Tries both turn directions and keeps the shorter path. Empty when the
 * fix is inside both turn circles, in which case going direct is the best we
 * can draw.
 */
export function turnOntoFix(
  from: LatLon,
  trackDeg: number,
  fix: LatLon,
  radiusNm: number,
  turn?: 'L' | 'R'
): LatLon[] {
  const kx = NM_PER_DEG_LAT * Math.cos((from.latitude * Math.PI) / 180);
  const f = {
    x: (fix.longitude - from.longitude) * kx,
    y: (fix.latitude - from.latitude) * NM_PER_DEG_LAT,
  };
  const h = (trackDeg * Math.PI) / 180;
  const r = radiusNm;

  let best: {
    side: 1 | -1;
    center: { x: number; y: number };
    theta0: number;
    sweep: number;
  } | null = null;
  let bestLength = Infinity;

  const sides: readonly (1 | -1)[] = turn === 'R' ? [1] : turn === 'L' ? [-1] : [1, -1];
  for (const side of sides) {
    // Centre sits one radius off the track: to the right for a right turn.
    const center = { x: side * Math.cos(h) * r, y: -side * Math.sin(h) * r };
    const d = Math.hypot(f.x - center.x, f.y - center.y);
    if (d <= r) continue;
    const alpha = Math.atan2(f.y - center.y, f.x - center.x);
    const delta = Math.acos(r / d);
    const theta0 = Math.atan2(-center.y, -center.x);
    for (const theta of [alpha + delta, alpha - delta]) {
      const t = { x: center.x + r * Math.cos(theta), y: center.y + r * Math.sin(theta) };
      // Velocity on the circle at theta, clockwise for a right turn.
      const vel =
        side === 1
          ? { x: Math.sin(theta), y: -Math.cos(theta) }
          : { x: -Math.sin(theta), y: Math.cos(theta) };
      const toFix = { x: f.x - t.x, y: f.y - t.y };
      if (vel.x * toFix.x + vel.y * toFix.y <= 0) continue;
      const raw = side === 1 ? theta0 - theta : theta - theta0;
      const sweep = ((raw % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const length = sweep * r + Math.hypot(toFix.x, toFix.y);
      if (length < bestLength) {
        bestLength = length;
        best = { side, center, theta0, sweep };
      }
    }
  }
  if (!best) return [];

  const steps = Math.max(2, Math.ceil(best.sweep / ARC_STEP_RAD));
  const out: LatLon[] = [];
  for (let i = 1; i <= steps; i++) {
    const ang = best.theta0 - (best.side * best.sweep * i) / steps;
    const x = best.center.x + r * Math.cos(ang);
    const y = best.center.y + r * Math.sin(ang);
    out.push({
      latitude: from.latitude + y / NM_PER_DEG_LAT,
      longitude: from.longitude + x / kx,
    });
  }
  return out;
}

/** A turn sweeping more than this (180°) isn't a real turn - a smaller radius fits instead. */
const MAX_REASONABLE_TURN_STEPS = Math.ceil(Math.PI / ARC_STEP_RAD);

/**
 * `turnOntoFix`, tried at progressively tighter radii starting from `maxRadiusNm`. turnOntoFix
 * tries both turn directions and keeps whichever circle fits; when the fix sits inside the
 * correct-direction circle at a given radius (a close fix needing a sizeable turn), only the
 * wrong-direction circle may produce a result there - a valid but near-full-circle sweep.
 * Prefers the first radius giving a real turn (<=180 degrees), falling back to a bigger sweep
 * only if no radius gives one. Keeps halving down to a small floor rather than stopping after a
 * couple of fixed steps - some published legs run under 1 NM and need a correspondingly tighter
 * radius before any clean solution exists at all.
 */
export function turnOntoFixRobust(
  from: LatLon,
  trackDeg: number,
  fix: LatLon,
  maxRadiusNm: number,
  turn?: 'L' | 'R'
): LatLon[] {
  let arc: LatLon[] = [];
  for (let r = maxRadiusNm; r >= 0.02; r /= 2) {
    const candidate = turnOntoFix(from, trackDeg, fix, r, turn);
    if (candidate.length === 0) continue;
    if (candidate.length <= MAX_REASONABLE_TURN_STEPS) {
      arc = candidate;
      break;
    }
    if (arc.length === 0) arc = candidate;
  }
  return arc;
}

/** Pre-built leg geometry to draw in place of the fixes that carry its via name. */
export interface ProcedurePathHint {
  via: string;
  path: LatLon[];
}

/** Straight climb, clamped so a first fix ahead is not overflown, then the turn onto it. */
function departureHead(
  end: RunwayEnd,
  target: LatLon | undefined,
  firstTurn?: 'L' | 'R',
  initialClimbNm?: number
): LatLon[] {
  let climb = initialClimbNm ?? CLIMB_OUT_NM;
  if (target) {
    // A first fix near the field can sit short of the climb-out; stop the straight
    // segment a turn radius before it rather than fly past and circle back. A fix
    // behind the runway is a published turn-back and keeps the full climb.
    const farEnd = destinationPoint(
      { latitude: end.latitude, longitude: end.longitude },
      end.headingDeg,
      end.lengthNm
    );
    const along = alongTrackNm(farEnd, end.headingDeg, target);
    if (along > 0) climb = Math.min(climb, Math.max(0, along - TERMINAL_TURN_RADIUS_NM));
  }
  const takeoff = takeoffPath(end, climb);
  if (!target) return takeoff;
  const climbEnd = takeoff[takeoff.length - 1]!;
  const arc = turnOntoFixRobust(
    climbEnd,
    end.headingDeg,
    target,
    TERMINAL_TURN_RADIUS_NM,
    firstTurn
  );
  return [...takeoff, ...arc];
}

function appendDeduped(line: LatLon[], points: LatLon[]): void {
  for (const p of points) {
    const last = line[line.length - 1];
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

export function routeLinePoints(
  waypoints: RoutePoint[],
  ends?: RunwayEnds,
  firstTurn?: 'L' | 'R',
  initialClimbNm?: number,
  procedurePaths?: ProcedurePathHint[]
): LatLon[] {
  // Runs of fixes covered by pre-built leg geometry are drawn as that geometry;
  // everything else is raw points that get fly-by smoothing.
  interface Piece {
    fixed: boolean;
    pts: LatLon[];
  }
  const pathByVia = new Map((procedurePaths ?? []).map((p) => [p.via, p.path]));
  const pieces: Piece[] = [];
  const used = new Set<string>();
  let departs = false;
  for (const wp of waypoints) {
    if (wp.via === 'ADEP' && ends?.departure) {
      departs = true;
      continue;
    }
    const path = wp.via ? pathByVia.get(wp.via) : undefined;
    if (path && path.length > 1) {
      if (!used.has(wp.via!)) {
        used.add(wp.via!);
        pieces.push({ fixed: true, pts: path });
      }
      continue;
    }
    const pts =
      wp.via === 'ADES' && ends?.arrival
        ? finalApproachPath(ends.arrival)
        : [{ latitude: wp.latitude, longitude: wp.longitude }];
    const last = pieces[pieces.length - 1];
    if (last && !last.fixed) last.pts.push(...pts);
    else pieces.push({ fixed: false, pts: [...pts] });
  }

  const line: LatLon[] = [];
  if (departs && ends?.departure) {
    if (pieces[0]?.fixed) {
      // The SID geometry starts at the runway far end; only the roll is added.
      line.push({ latitude: ends.departure.latitude, longitude: ends.departure.longitude });
    } else {
      appendDeduped(
        line,
        departureHead(ends.departure, pieces[0]?.pts[0], firstTurn, initialClimbNm)
      );
    }
  }
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i]!;
    if (piece.fixed) {
      appendDeduped(line, piece.pts);
      continue;
    }
    const prev = line[line.length - 1];
    const nextFixed = pieces[i + 1]?.fixed ? pieces[i + 1]!.pts[0] : undefined;
    const input = [...(prev ? [prev] : []), ...piece.pts, ...(nextFixed ? [nextFixed] : [])];
    const smoothed = smoothRoutePath(input, ENROUTE_TURN_RADIUS_NM);
    appendDeduped(line, smoothed.slice(prev ? 1 : 0, nextFixed ? smoothed.length - 1 : undefined));
  }
  return line;
}
