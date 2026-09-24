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
  return [threshold, farEnd, destinationPoint(farEnd, end.headingDeg, climbOutNm)];
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

export function routeLinePoints(
  waypoints: RoutePoint[],
  ends?: RunwayEnds,
  firstTurn?: 'L' | 'R',
  initialClimbNm?: number
): LatLon[] {
  let takeoff: LatLon[] | null = null;
  const core: LatLon[] = [];
  for (const wp of waypoints) {
    if (wp.via === 'ADEP' && ends?.departure) {
      takeoff = takeoffPath(ends.departure, initialClimbNm ?? CLIMB_OUT_NM);
    } else if (wp.via === 'ADES' && ends?.arrival) {
      core.push(...finalApproachPath(ends.arrival));
    } else {
      core.push({ latitude: wp.latitude, longitude: wp.longitude });
    }
  }

  if (!takeoff || !ends?.departure) return smoothRoutePath(core, ENROUTE_TURN_RADIUS_NM);
  if (core.length === 0) return takeoff;

  const climbEnd = takeoff[takeoff.length - 1]!;
  const arc = turnOntoFix(
    climbEnd,
    ends.departure.headingDeg,
    core[0]!,
    TERMINAL_TURN_RADIUS_NM,
    firstTurn
  );
  const head = [...takeoff, ...arc];
  const tail = smoothRoutePath([head[head.length - 1]!, ...core], ENROUTE_TURN_RADIUS_NM);
  return [...head, ...tail.slice(1)];
}
