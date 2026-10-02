/**
 * Draws a procedure the way its ARINC 424 legs say it is flown, leg by leg, instead of guessing
 * geometry between the fixes. Course legs turn onto and hold their published course, RF/AF legs
 * draw real arcs off their resolved center/DME station, CI/VI/CR/VR intercept the real course
 * they're published against, CD/VD/FD/FC cross a real DME ring, and PI/HA/HF/HM get a procedure
 * turn or holding-pattern overlay anchored on the real fix. Every published course is converted
 * from magnetic to true per-position (WMM), not guessed once for the whole procedure.
 *
 * Known remaining approximation: altitude-terminated legs (CA/VA/FA) climb from sea level, not
 * the departure runway's elevation - that needs airport elevation threaded through the persisted
 * `PlanEndpoint`/`RunwayEnd` types, which is a separate, smaller follow-up.
 */
import { magneticToTrue } from '@/lib/magvar';
import {
  createHoldingPattern,
  createProcedureTurn,
  crossTrackStatus,
  interpolateRFArc,
  intersectRadials,
  lineCircleIntersection,
} from '@/lib/utils/geomath';
import type { Degrees, NauticalMiles } from '@/lib/utils/geomath';
import type { RunwayEnd } from '@/types/fms';
import type {
  PathTerminator,
  ResolvedProcedure,
  ResolvedProcedureWaypoint,
} from '@/types/navigation';
import { type LatLon, bearingDeg, destinationPoint, greatCircleNm } from './geometry';
import { turnOntoFix } from './routeLine';

/** Turn radius inside a terminal procedure, at climb speed. */
const TURN_RADIUS_NM = 2;
/** Planning climb gradient for altitude-terminated legs (LNM's figure; ours was 300, half real). */
const CLIMB_FT_PER_NM = 600;
const MIN_LEG_NM = 2;
const MAX_LEG_NM = 20;
/** Length assumed for an intercept, radial or manual-termination leg when no real crossing is found. */
const FALLBACK_LEG_NM = 3;
/** A computed intercept/radial/DME crossing further than this from its leg's start is untrustworthy. */
const MAX_INTERCEPT_NM = 150;
const ARC_STEP_DEG = 10;
/** A turn-onto-fix sweeping more than this (180°) isn't a real turn - a smaller radius fits
 * the correct direction's circle instead; see `arriveAtFix`. */
const MAX_REASONABLE_TURN_STEPS = Math.ceil(180 / ARC_STEP_DEG);
/** Assumed holding speed when a hold publishes leg *time* but not leg *distance*. */
const HOLD_SPEED_KT = 180;
const DEFAULT_HOLD_LEG_NM = 1;
const DEFAULT_PT_OUTBOUND_NM = 2;

const norm180 = (deg: number): number => (((deg % 360) + 540) % 360) - 180;
const norm360 = (deg: number): number => ((deg % 360) + 360) % 360;

/** Legs that end at their fix with no special termination math of their own. */
const PLAIN_FLY_TO = new Set<PathTerminator>(['IF', 'TF', 'CF', 'DF']);
/** Legs terminated by reaching an altitude. */
const TO_ALTITUDE = new Set<PathTerminator>(['CA', 'VA', 'FA']);
/** Legs terminated by a DME distance from a fix or navaid. */
const TO_DISTANCE = new Set<PathTerminator>(['CD', 'VD', 'FD', 'FC']);
/** Legs terminated by intercepting the next leg's course. */
const TO_INTERCEPT = new Set<PathTerminator>(['CI', 'VI']);
/** Legs terminated by reaching a published radial from the recommended navaid. */
const TO_RADIAL = new Set<PathTerminator>(['CR', 'VR']);
/** Legs with no defined endpoint - flown until manually terminated by ATC/the pilot. */
const MANUAL_TERMINATION = new Set<PathTerminator>(['FM', 'VM']);
/** Legs that fly to their fix, then loop there (procedure turn or hold). */
const LOOPS_AT_FIX = new Set<PathTerminator>(['PI', 'HA', 'HF', 'HM']);

/**
 * How a CI/VI intercept's raw (unbounded) crossing point gets clipped against the leg it
 * intercepts - mirrors atools' `processCourseInterceptLegs` (littlenavmap, procedurequery.cpp):
 * it re-clips the geometric intersection to the next leg's own segment bounds rather than
 * drawing the full, possibly-overshooting crossing point.
 *
 * Arrival-anchored: the leg's own fix is its *far* end (arrived at from behind) - only clip an
 * intersection that overshoots past it.
 */
const ARRIVAL_ANCHORED = new Set<PathTerminator>(['IF', 'TF', 'CF', 'DF', 'RF', 'AF']);
/** Departure-anchored: the leg's own fix is its *near* end (flown away from) for a bounded length. */
const DEPARTURE_ANCHORED = new Set<PathTerminator>(['FM', 'VM']);

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

/** A published magnetic course, converted to true at the given position. Null passes through. */
function trueCourse(courseDeg: number | null, at: LatLon): number | null {
  if (courseDeg === null) return null;
  return magneticToTrue(courseDeg as Degrees, at.latitude, at.longitude);
}

/** The heading to actually fly: the published course, unless it's within a few degrees of the
 * current track already (then keep the track, so near-identical courses don't jitter the line). */
function headingToFly(state: PathState, courseTrue: number | null): number {
  if (courseTrue === null) return state.trackDeg;
  return Math.abs(norm180(courseTrue - state.trackDeg)) < 5 ? state.trackDeg : courseTrue;
}

function altitudeLegNm(wp: ResolvedProcedureWaypoint): number | undefined {
  const alt = wp.altitude?.altitude1;
  if (alt === null || alt === undefined) return undefined;
  return Math.min(MAX_LEG_NM, Math.max(MIN_LEG_NM, alt / CLIMB_FT_PER_NM));
}

/** Resolved position of a leg's recommended navaid (AF station, or CF/CI/CR reference), if any. */
function recNavaidPosition(wp: ResolvedProcedureWaypoint): LatLon | null {
  const { recNavaidLatitude: lat, recNavaidLongitude: lon } = wp;
  return lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : null;
}

/** Resolved position of an RF leg's arc center. */
function centerFixPosition(wp: ResolvedProcedureWaypoint): LatLon | null {
  const { centerFixLatitude: lat, centerFixLongitude: lon } = wp;
  return lat !== undefined && lon !== undefined ? { latitude: lat, longitude: lon } : null;
}

/** A real constant-radius arc (RF/AF) from `state` to `fix`, around `center`; empty if degenerate. */
function arcAroundCenter(
  state: PathState,
  fix: LatLon,
  center: LatLon,
  turnDirection: 'L' | 'R' | null
): LatLon[] {
  const radiusNm = greatCircleNm(center, fix);
  if (radiusNm < 0.05) return [];
  const centerBearing = bearingDeg(state.position, center);
  const points = interpolateRFArc(
    [state.position.longitude, state.position.latitude],
    [fix.longitude, fix.latitude],
    centerBearing,
    radiusNm,
    turnDirection ?? 'R'
  );
  // interpolateRFArc returns [lon, lat]; drop the duplicated start point.
  return points.slice(1).map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
}

export interface ProcedureOverlay {
  fixId: string;
  kind: 'holding' | 'procedureTurn';
  points: LatLon[];
}

/** Hold leg length in NM: published distance first, else time-at-assumed-speed, else a default. */
function holdLegNm(wp: ResolvedProcedureWaypoint): number {
  if (wp.distance !== null) return wp.distance;
  if (wp.holdTimeMin !== null) return (wp.holdTimeMin / 60) * HOLD_SPEED_KT;
  return DEFAULT_HOLD_LEG_NM;
}

function buildOverlay(
  wp: ResolvedProcedureWaypoint,
  fix: LatLon,
  courseTrue: number | null
): ProcedureOverlay | null {
  if (courseTrue === null) return null;
  const turn = wp.turnDirection ?? 'R';
  if (wp.pathTerminator === 'PI') {
    const points = createProcedureTurn(
      [fix.longitude, fix.latitude],
      courseTrue,
      turn,
      DEFAULT_PT_OUTBOUND_NM
    );
    return { fixId: wp.fixId, kind: 'procedureTurn', points: points.map(toLatLon) };
  }
  const points = createHoldingPattern(
    [fix.longitude, fix.latitude],
    courseTrue,
    holdLegNm(wp),
    turn
  );
  return { fixId: wp.fixId, kind: 'holding', points: points.map(toLatLon) };
}

function toLatLon([lon, lat]: [number, number]): LatLon {
  return { latitude: lat, longitude: lon };
}

export interface ProcedurePathOptions {
  /** Where the drawing starts: the runway end for a SID. */
  start?: PathState;
  /** Distance already flown towards an on-field DME before the drawing starts. */
  dmeOffsetNm?: number;
}

export interface ProcedurePathResult {
  path: LatLon[];
  /** The missed-approach portion, kept separate so it can be drawn distinctly (e.g. dashed) - it
   * repeats `path`'s last point first, so the two connect with no visual gap. */
  missedPath: LatLon[];
  overlays: ProcedureOverlay[];
}

/**
 * The polyline a procedure's legs trace, plus any hold/procedure-turn overlay shapes. Without a
 * start the line begins at the first resolved fix, as a STAR or approach is entered in flight.
 */
export function procedureGeometry(
  waypoints: ResolvedProcedureWaypoint[],
  options: ProcedurePathOptions = {}
): ProcedurePathResult {
  const out: LatLon[] = [];
  const missedOut: LatLon[] = [];
  const overlays: ProcedureOverlay[] = [];
  let state: PathState | null = options.start ?? null;
  let currentIsMissed = false;

  const append = (points: LatLon[]) => {
    const target = currentIsMissed ? missedOut : out;
    if (currentIsMissed && target.length === 0 && out.length > 0) {
      target.push(out[out.length - 1]!); // bridge the gap so the dashed segment connects
    }
    for (const p of points) {
      const last = target[target.length - 1];
      if (
        last &&
        Math.abs(last.latitude - p.latitude) < 1e-7 &&
        Math.abs(last.longitude - p.longitude) < 1e-7
      ) {
        continue;
      }
      target.push(p);
    }
  };

  /** Arrive at a resolved fix from the current state, turning onto it if a track is established. */
  const arriveAtFix = (fix: LatLon, turn: ResolvedProcedureWaypoint['turnDirection']) => {
    if (!state) {
      append([fix]);
      state = { position: fix, trackDeg: NaN };
      return;
    }
    if (Number.isNaN(state.trackDeg)) {
      append([fix]);
      state = { position: fix, trackDeg: bearingDeg(state.position, fix) };
      return;
    }
    // turnOntoFix tries both turn directions and keeps whichever circle fits; when the fix sits
    // inside the correct-direction circle at the default radius (a close fix needing a sizeable
    // turn), only the wrong-direction circle may produce a result there - a "valid" but
    // near-full-circle sweep. Prefer the first radius that gives a real turn (<=180 degrees);
    // only fall back to a bigger sweep if no radius gives one.
    let arc: LatLon[] = [];
    for (const r of [TURN_RADIUS_NM, TURN_RADIUS_NM / 2, TURN_RADIUS_NM / 4]) {
      const candidate = turnOntoFix(state.position, state.trackDeg, fix, r, turn ?? undefined);
      if (candidate.length === 0) continue;
      if (candidate.length <= MAX_REASONABLE_TURN_STEPS) {
        arc = candidate;
        break;
      }
      if (arc.length === 0) arc = candidate;
    }
    append(arc);
    append([fix]);
    const before = arc[arc.length - 1] ?? state.position;
    state = { position: fix, trackDeg: bearingDeg(before, fix) };
  };

  /** Fly a heading from the current state for a length, after turning onto it. */
  const flyHeading = (headingTrue: number, lengthNm: number) => {
    if (!state) return;
    const heading = headingToFly(state, headingTrue);
    const arc = turnOntoHeading(state, heading, undefined);
    append(arc);
    const from = arc[arc.length - 1] ?? state.position;
    const end = destinationPoint(from, heading, lengthNm);
    append([end]);
    state = { position: end, trackDeg: heading };
  };

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i]!;
    if (wp.fixType === 'C' || wp.fixType === 'A') continue;
    currentIsMissed = wp.isMissedApproach;
    const term = wp.pathTerminator;

    // Real constant-radius arcs, falling back to a plain turn onto the fix when the center or
    // DME station couldn't be resolved.
    if ((term === 'RF' || term === 'AF') && state && !Number.isNaN(state.trackDeg)) {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      const center = term === 'RF' ? centerFixPosition(wp) : recNavaidPosition(wp);
      const arc = center ? arcAroundCenter(state, fix, center, wp.turnDirection) : [];
      if (arc.length > 0) {
        append(arc);
        const before = arc[arc.length - 2] ?? state.position;
        state = { position: fix, trackDeg: bearingDeg(before, fix) };
        continue;
      }
      // No resolved center - fall through to the plain fix arrival below.
    }

    if (PLAIN_FLY_TO.has(term) || term === 'RF' || term === 'AF') {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      arriveAtFix({ latitude: wp.latitude, longitude: wp.longitude }, wp.turnDirection);
      continue;
    }

    if (LOOPS_AT_FIX.has(term)) {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      arriveAtFix(fix, wp.turnDirection);
      const courseTrue = trueCourse(wp.course, fix);
      const overlay = buildOverlay(wp, fix, courseTrue);
      if (overlay) overlays.push(overlay);
      continue;
    }

    // Everything past this point is a course/heading leg with no fix of its own: it needs an
    // established track to fly from.
    if (!state || Number.isNaN(state.trackDeg)) continue;
    const courseTrue = trueCourse(wp.course, state.position);

    if (TO_ALTITUDE.has(term)) {
      const lengthNm = altitudeLegNm(wp);
      if (lengthNm === undefined) continue;
      flyHeading(courseTrue ?? state.trackDeg, lengthNm);
      continue;
    }

    if (TO_DISTANCE.has(term)) {
      const heading = headingToFly(state, courseTrue);
      const arc = turnOntoHeading(state, heading, undefined);
      append(arc);
      const from = arc[arc.length - 1] ?? state.position;
      const center = recNavaidPosition(wp);
      const radiusNm = wp.distance ?? wp.rho;
      let target: LatLon | null = null;
      if (center && radiusNm !== null) {
        target = lineCircleIntersection(
          from,
          heading as Degrees,
          center,
          radiusNm as NauticalMiles
        );
      }
      if (!target || greatCircleNm(from, target) > MAX_INTERCEPT_NM) {
        const offset = out.length === 0 ? (options.dmeOffsetNm ?? 0) : 0;
        const fallbackNm = wp.distance !== null ? Math.max(0.5, wp.distance - offset) : undefined;
        if (fallbackNm === undefined) continue;
        target = destinationPoint(from, heading, fallbackNm);
      }
      append([target]);
      state = { position: target, trackDeg: heading };
      continue;
    }

    if (TO_RADIAL.has(term)) {
      const heading = headingToFly(state, courseTrue);
      const arc = turnOntoHeading(state, heading, undefined);
      append(arc);
      const from = arc[arc.length - 1] ?? state.position;

      const navaid = recNavaidPosition(wp);
      const radialTrue = navaid ? trueCourse(wp.theta, navaid) : null;
      let target: LatLon | null = null;
      if (navaid && radialTrue !== null) {
        target = intersectRadials(from, heading as Degrees, navaid, norm360(radialTrue) as Degrees);
        // atools only accepts a CR/VR crossing 1.5-200 NM from the navaid; outside that it holds
        // the current position rather than drawing a guessed stub.
        if (target) {
          const distFromNavaid = greatCircleNm(navaid, target);
          if (distFromNavaid < 1.5 || distFromNavaid > 200) target = null;
        }
      }

      append([target ?? from]);
      state = { position: target ?? from, trackDeg: heading };
      continue;
    }

    if (TO_INTERCEPT.has(term)) {
      const heading = headingToFly(state, courseTrue);
      const arc = turnOntoHeading(state, heading, undefined);
      append(arc);
      const from = arc[arc.length - 1] ?? state.position;

      const nextIndex = waypoints.findIndex((w, idx) => idx > i && w.resolved && w.course !== null);
      const next = nextIndex >= 0 ? waypoints[nextIndex] : undefined;
      const nextAnchor =
        next && next.latitude !== undefined && next.longitude !== undefined
          ? { latitude: next.latitude, longitude: next.longitude }
          : null;
      const nextCourseTrue = next && nextAnchor ? trueCourse(next.course, nextAnchor) : null;

      let target: LatLon | null = null;
      if (nextAnchor && nextCourseTrue !== null) {
        target = intersectRadials(
          from,
          heading as Degrees,
          nextAnchor,
          norm360(nextCourseTrue) as Degrees
        );
      }

      let resultTrackDeg = heading;
      let consumedNextIndex = -1;

      if (target && nextAnchor && nextCourseTrue !== null && next) {
        // Re-clip the raw crossing to the next leg's own segment, the way atools'
        // processCourseInterceptLegs does, instead of drawing wherever the two infinite
        // courses happen to cross (which can overshoot far past the next leg entirely).
        const status = crossTrackStatus(target, nextAnchor, norm360(nextCourseTrue) as Degrees);
        if (ARRIVAL_ANCHORED.has(next.pathTerminator)) {
          // The fix is the leg's far end; only clip an intersection that overshoots past it.
          if (status.alongTrackNm > 0) target = nextAnchor;
        } else if (DEPARTURE_ANCHORED.has(next.pathTerminator)) {
          // The fix is the leg's near end; the valid zone is [0, its own length] ahead of it.
          const bound = next.distance ?? FALLBACK_LEG_NM;
          if (status.alongTrackNm < 0) {
            target = nextAnchor;
          } else if (status.alongTrackNm > bound) {
            target = destinationPoint(nextAnchor, nextCourseTrue, bound);
            consumedNextIndex = nextIndex; // this leg's own length is already fully drawn
          }
          resultTrackDeg = nextCourseTrue;
        }
      } else if (nextAnchor) {
        // No crossing found - atools falls back to a straight line to where the next leg starts.
        target = nextAnchor;
      }

      if (!target) target = destinationPoint(from, heading, FALLBACK_LEG_NM);

      append([target]);
      state = { position: target, trackDeg: resultTrackDeg };
      if (consumedNextIndex >= 0) i = consumedNextIndex;
      continue;
    }

    if (MANUAL_TERMINATION.has(term)) {
      // FM/VM always departs from its own fix along its own course (atools uses leg.fixPos
      // unconditionally), not a continuation of wherever the previous leg's drawing ended -
      // a preceding CI/VI is what's responsible for bridging that gap, via the clipping above.
      const anchor =
        wp.latitude !== undefined && wp.longitude !== undefined
          ? { latitude: wp.latitude, longitude: wp.longitude }
          : state.position;
      const anchorCourseTrue = trueCourse(wp.course, anchor) ?? state.trackDeg;
      const lengthNm = wp.distance ?? FALLBACK_LEG_NM;
      const end = destinationPoint(anchor, anchorCourseTrue, lengthNm);
      append([anchor, end]);
      state = { position: end, trackDeg: anchorCourseTrue };
      continue;
    }
  }

  return { path: out, missedPath: missedOut, overlays };
}

/** `procedureGeometry`'s flattened path only - the shape most callers want. */
export function procedurePath(
  waypoints: ResolvedProcedureWaypoint[],
  options: ProcedurePathOptions = {}
): LatLon[] {
  return procedureGeometry(waypoints, options).path;
}

export interface ProcedurePathHint {
  /** The `via` name the plan's waypoints carry for this procedure. */
  via: string;
  path: LatLon[];
  /** The missed-approach portion, if any - drawn distinctly from `path`, not spliced into it. */
  missedPath: LatLon[];
  overlays: ProcedureOverlay[];
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
    const { path, missedPath, overlays } = procedureGeometry(parts.sid.waypoints, {
      start: { position: farEnd, trackDeg: departureEnd.headingDeg },
      dmeOffsetNm: departureEnd.lengthNm / 2,
    });
    if (path.length > 0) {
      out.push({ via: parts.sid.name, path: [farEnd, ...path], missedPath, overlays });
    }
  }
  for (const p of [parts.star, parts.approach]) {
    if (!p) continue;
    const { path, missedPath, overlays } = procedureGeometry(p.waypoints);
    if (path.length > 1) out.push({ via: p.name, path, missedPath, overlays });
  }
  return out;
}
