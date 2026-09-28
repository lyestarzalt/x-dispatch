/**
 * Draws a procedure the way its ARINC 424 legs say it is flown, leg by leg,
 * instead of guessing geometry between the fixes. Course legs turn onto and
 * hold their published course, distance and altitude legs get a length, and
 * every turn honours the leg's own published direction. Approximations: RF and
 * AF arcs are drawn as plain turns onto the fix, holds and procedure turns as
 * the fix alone.
 */
import type { RunwayEnd } from '@/types/fms';
import type { ResolvedProcedure, ResolvedProcedureWaypoint } from '@/types/navigation';
import { type LatLon, bearingDeg, destinationPoint } from './geometry';
import { turnOntoFix } from './routeLine';

/** Turn radius inside a terminal procedure, at climb speed. */
const TURN_RADIUS_NM = 2;
/** Planning climb gradient for altitude-terminated legs. */
const CLIMB_FT_PER_NM = 300;
const MIN_LEG_NM = 2;
const MAX_LEG_NM = 20;
/** Length assumed for an intercept or radial termination leg. */
const INTERCEPT_NM = 3;
const ARC_STEP_DEG = 10;
/** Published course this far off the runway heading means it is not runway-aligned. */
const MAX_MAGVAR_DEG = 25;

const norm180 = (deg: number): number => (((deg % 360) + 540) % 360) - 180;

/** Legs that end at their fix; any other type only references its fix. */
const FLY_TO = new Set(['IF', 'TF', 'CF', 'DF', 'RF', 'AF', 'HA', 'HF', 'HM', 'PI']);
/** Legs terminated by reaching an altitude. */
const TO_ALTITUDE = new Set(['CA', 'VA', 'FA']);
/** Legs terminated by a distance from a fix or navaid. */
const TO_DISTANCE = new Set(['CD', 'VD', 'FD', 'FC']);
/** Legs terminated by an intercept or a radial. */
const TO_INTERCEPT = new Set(['CI', 'VI', 'CR', 'VR']);

interface PathState {
  position: LatLon;
  trackDeg: number;
}

/** Arc from the current track onto a target heading; empty for a negligible turn. */
function turnOntoHeading(state: PathState, targetDeg: number, turn?: 'L' | 'R' | null): LatLon[] {
  const diff = norm180(targetDeg - state.trackDeg);
  const side = turn === 'R' ? 1 : turn === 'L' ? -1 : diff >= 0 ? 1 : -1;
  const sweep = side === 1 ? (diff + 360) % 360 : (-diff + 360) % 360;
  if (sweep < 3 || sweep > 350) return [];
  const center = destinationPoint(state.position, state.trackDeg + side * 90, TURN_RADIUS_NM);
  const out: LatLon[] = [];
  const steps = Math.max(2, Math.ceil(sweep / ARC_STEP_DEG));
  for (let i = 1; i <= steps; i++) {
    const heading = state.trackDeg + (side * sweep * i) / steps;
    out.push(destinationPoint(center, heading - side * 90, TURN_RADIUS_NM));
  }
  return out;
}

/**
 * Published courses are magnetic and the map lives in true bearings. On a SID
 * the first course leg is flown along the runway, so the difference to the true
 * runway heading is the local variation. Anything larger is a genuine turn and
 * no correction is made.
 */
function magneticVariation(
  waypoints: ResolvedProcedureWaypoint[],
  runwayHeadingTrue: number | undefined
): number {
  if (runwayHeadingTrue === undefined) return 0;
  const first = waypoints.find((wp) => wp.course !== null);
  if (!first || first.course === null) return 0;
  const diff = norm180(runwayHeadingTrue - first.course);
  return Math.abs(diff) <= MAX_MAGVAR_DEG ? diff : 0;
}

function altitudeLegNm(wp: ResolvedProcedureWaypoint): number | undefined {
  const alt = wp.altitude?.altitude1;
  if (alt === null || alt === undefined) return undefined;
  return Math.min(MAX_LEG_NM, Math.max(MIN_LEG_NM, alt / CLIMB_FT_PER_NM));
}

export interface ProcedurePathOptions {
  /** Where the drawing starts: the runway end for a SID. */
  start?: PathState;
  /** Distance already flown towards an on-field DME before the drawing starts. */
  dmeOffsetNm?: number;
}

/**
 * The polyline a procedure's legs trace. Without a start the line begins at the
 * first resolved fix, as a STAR or approach is entered in flight.
 */
export function procedurePath(
  waypoints: ResolvedProcedureWaypoint[],
  options: ProcedurePathOptions = {}
): LatLon[] {
  const magvar = magneticVariation(waypoints, options.start?.trackDeg);
  const out: LatLon[] = [];
  let state: PathState | null = options.start ?? null;

  const append = (points: LatLon[]) => {
    for (const p of points) {
      const last = out[out.length - 1];
      if (
        last &&
        Math.abs(last.latitude - p.latitude) < 1e-7 &&
        Math.abs(last.longitude - p.longitude) < 1e-7
      ) {
        continue;
      }
      out.push(p);
    }
  };

  for (const wp of waypoints) {
    if (wp.fixType === 'C' || wp.fixType === 'A') continue;

    if (FLY_TO.has(wp.pathTerminator)) {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      if (!state) {
        append([fix]);
        state = { position: fix, trackDeg: NaN };
        continue;
      }
      if (Number.isNaN(state.trackDeg)) {
        append([fix]);
        state = { position: fix, trackDeg: bearingDeg(state.position, fix) };
        continue;
      }
      // A fix inside the turn circle cannot be reached at full radius; a real
      // aircraft would overshoot, but the chart line just turns tighter.
      let arc: LatLon[] = [];
      for (const r of [TURN_RADIUS_NM, TURN_RADIUS_NM / 2, TURN_RADIUS_NM / 4]) {
        arc = turnOntoFix(state.position, state.trackDeg, fix, r, wp.turnDirection ?? undefined);
        if (arc.length > 0) break;
      }
      append(arc);
      append([fix]);
      const before = arc[arc.length - 1] ?? state.position;
      state = { position: fix, trackDeg: bearingDeg(before, fix) };
      continue;
    }

    // A course leg with no usable start cannot be placed on the map.
    if (!state || Number.isNaN(state.trackDeg)) continue;

    let lengthNm: number | undefined;
    if (TO_ALTITUDE.has(wp.pathTerminator)) lengthNm = altitudeLegNm(wp);
    else if (TO_DISTANCE.has(wp.pathTerminator)) {
      if (wp.distance !== null) {
        const offset = out.length === 0 ? (options.dmeOffsetNm ?? 0) : 0;
        lengthNm = Math.max(0.5, wp.distance - offset);
      }
    } else if (TO_INTERCEPT.has(wp.pathTerminator)) lengthNm = INTERCEPT_NM;
    if (lengthNm === undefined) continue;

    const course = wp.course === null ? state.trackDeg : wp.course + magvar;
    // A published course within a few degrees of the track is the same line.
    const heading = Math.abs(norm180(course - state.trackDeg)) < 5 ? state.trackDeg : course;
    const arc = turnOntoHeading(state, heading, wp.turnDirection);
    append(arc);
    const from = arc[arc.length - 1] ?? state.position;
    const end = destinationPoint(from, heading, lengthNm);
    append([end]);
    state = { position: end, trackDeg: heading };
  }

  return out;
}

export interface ProcedurePathHint {
  /** The `via` name the plan's waypoints carry for this procedure. */
  via: string;
  path: LatLon[];
}

/** Pre-built geometry for each chosen procedure, for the route line to splice in. */
export function builtProcedurePaths(
  parts: { sid?: ResolvedProcedure; star?: ResolvedProcedure; approach?: ResolvedProcedure },
  departureEnd?: RunwayEnd
): ProcedurePathHint[] {
  const out: ProcedurePathHint[] = [];
  if (parts.sid && departureEnd) {
    const threshold = { latitude: departureEnd.latitude, longitude: departureEnd.longitude };
    const farEnd = destinationPoint(threshold, departureEnd.headingDeg, departureEnd.lengthNm);
    const path = procedurePath(parts.sid.waypoints, {
      start: { position: farEnd, trackDeg: departureEnd.headingDeg },
      dmeOffsetNm: departureEnd.lengthNm / 2,
    });
    if (path.length > 0) out.push({ via: parts.sid.name, path: [farEnd, ...path] });
  }
  for (const p of [parts.star, parts.approach]) {
    if (!p) continue;
    const path = procedurePath(p.waypoints);
    if (path.length > 1) out.push({ via: p.name, path });
  }
  return out;
}
