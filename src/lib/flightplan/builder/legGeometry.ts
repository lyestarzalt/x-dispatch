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

/** Planning climb gradient for altitude-terminated legs (LNM's figure; ours was 300, half real). */
const CLIMB_FT_PER_NM = 600;
/** LNM's flat length for any altitude leg that isn't a SID's first leg off the runway. */
const FLAT_LEG_NM = 2;
/** Length assumed for an intercept, radial or manual-termination leg when no real crossing is found. */
const FALLBACK_LEG_NM = 3;
/** Samples drawn for the small bezier that hints at a published turn. */
const TURN_HINT_STEPS = 8;
/** Samples drawn for the bezier bow that joins two legs whose lines don't connect. */
const BOW_STEPS = 12;
/** LNM starts the CR/VR course line 2 NM to the side a published turn would leave the aircraft. */
const RADIAL_TURN_OFFSET_NM = 2;
/** LNM considers a CF course more than this far round from the inbound track a reversal (bow, no intercept). */
const REVERSAL_DEG = 150;
/** LNM's hold sizing: 3.5 NM of straight leg per published minute, and 3.5 NM when nothing is published. */
const HOLD_NM_PER_MINUTE = 3.5;
const DEFAULT_HOLD_LEG_NM = 3.5;
/** LNM's procedure-turn symbol: a 3 NM straight segment, 180-degree turn of half that diameter. */
const PT_SEGMENT_NM = 3;

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
/** Hold legs: fly to the fix, then loop there. */
const LOOPS_AT_FIX = new Set<PathTerminator>(['HA', 'HF', 'HM']);
/**
 * Legs for which LNM draws a small turn hint when a turn direction is published
 * (mappainterroute.cpp, paintProcedureSegment's "Turn found" branch). Arcs, holds, procedure
 * turns and DME-distance legs are not in the list and are always drawn straight.
 */
const TURN_HINT_LEGS = new Set<PathTerminator>([
  'CA',
  'CF',
  'DF',
  'FA',
  'TF',
  'FC',
  'FM',
  'VA',
  'VM',
  'CI',
  'VI',
  'CR',
  'VR',
]);

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

/** Cubic bezier sampled in a flat frame around `p0` (fine at the sub-NM scale it's used for). */
function cubicBezier(p0: LatLon, c1: LatLon, c2: LatLon, p3: LatLon, steps: number): LatLon[] {
  const kx = 60 * Math.cos((p0.latitude * Math.PI) / 180);
  const local = (p: LatLon) => ({
    e: (p.longitude - p0.longitude) * kx,
    n: (p.latitude - p0.latitude) * 60,
  });
  const [a, b, c, d] = [local(p0), local(c1), local(c2), local(p3)];
  const out: LatLon[] = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    const w = [u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t] as const;
    const e = w[0] * a.e + w[1] * b.e + w[2] * c.e + w[3] * d.e;
    const n = w[0] * a.n + w[1] * b.n + w[2] * c.n + w[3] * d.n;
    out.push({ latitude: p0.latitude + n / 60, longitude: p0.longitude + e / kx });
  }
  return out;
}

/**
 * LNM's `paintProcedureTurn`: when a leg publishes a turn direction, leave 0.5 NM (1 NM for a
 * course reversal) at its start and fill it with a small bezier bending the published way, then
 * run straight to the end. This is the *only* turn geometry LNM adds between straight legs - a
 * fly-by radius is never invented. Empty (plain straight line) when the leg has no published
 * turn, isn't a type LNM hints, or is too short to leave room for the hint.
 */
function publishedTurnHint(
  from: LatLon,
  inboundDeg: number,
  end: LatLon,
  wp: ResolvedProcedureWaypoint
): LatLon[] {
  const turn = wp.turnDirection;
  if ((turn !== 'L' && turn !== 'R') || !TURN_HINT_LEGS.has(wp.pathTerminator)) return [];
  const outboundDeg = bearingDeg(from, end);
  const diff = Math.abs(norm180(outboundDeg - inboundDeg));
  if (diff < 1) return [];
  const extensionNm = diff > 179 ? 1 : 0.5;
  if (greatCircleNm(from, end) < extensionNm * 2) return [];
  // The hint ends on the bisector of the inbound continuation and the outbound line, on the
  // side the published turn names (LNM: reversed last line + half the angle between, +180 for R).
  const ccw = norm360(outboundDeg - inboundDeg);
  const hintDeg = turn === 'R' ? inboundDeg + ccw / 2 : inboundDeg + 180 + ccw / 2;
  const hintEnd = destinationPoint(from, hintDeg, extensionNm);
  const c1 = destinationPoint(from, inboundDeg, extensionNm / 2);
  const c2 = destinationPoint(hintEnd, bearingDeg(end, hintEnd), extensionNm / 2);
  return cubicBezier(from, c1, c2, hintEnd, TURN_HINT_STEPS);
}

/** A published magnetic course, converted to true at the given position. Null passes through. */
function trueCourse(courseDeg: number | null, at: LatLon): number | null {
  if (courseDeg === null) return null;
  return magneticToTrue(courseDeg as Degrees, at.latitude, at.longitude);
}

/**
 * Length of an altitude-terminated leg. LNM only does the climb-gradient math for a SID's first
 * leg off the runway; every other CA/VA/FA - missed-approach climbs included - is a flat 2 NM
 * (procedurequery.cpp, COURSE_TO_ALTITUDE branch). Same here.
 */
function altitudeLegNm(
  wp: ResolvedProcedureWaypoint,
  firstDepartureLeg: boolean,
  runwayElevationFt: number | undefined
): number {
  const alt = wp.altitude?.altitude1;
  if (!firstDepartureLeg || alt === null || alt === undefined) return FLAT_LEG_NM;
  const climbFt = alt - (runwayElevationFt ?? 0);
  // An altitude at or below the runway is bad data; LNM would draw a zero/negative leg.
  return climbFt > 0 ? climbFt / CLIMB_FT_PER_NM : FLAT_LEG_NM;
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

/**
 * LNM's `paintProcedureBow`: when a leg's line does not start where the previous one ended and
 * the leg publishes a turn direction, the gap is bridged by a cubic bezier that leaves along the
 * previous track and arrives tangent to the new line, which it joins 0.95 NM in (when the line is
 * long enough). Without a published turn LNM simply closes the gap with a straight line.
 * Returns the points to append *before* `legEnd`.
 */
function gapJoin(
  from: LatLon,
  fromTrackDeg: number,
  legStart: LatLon,
  legEnd: LatLon,
  wp: ResolvedProcedureWaypoint
): LatLon[] {
  const turn = wp.turnDirection;
  const bow =
    (turn === 'L' || turn === 'R') &&
    TURN_HINT_LEGS.has(wp.pathTerminator) &&
    !Number.isNaN(fromTrackDeg);
  if (!bow) return [legStart];
  const lineDeg = bearingDeg(legStart, legEnd);
  const drawStart =
    greatCircleNm(legStart, legEnd) > 0.95 * 2
      ? destinationPoint(legStart, lineDeg, 0.95)
      : legStart;
  const dist = (greatCircleNm(from, legStart) * 3) / 4;
  const c1 = destinationPoint(from, fromTrackDeg, dist);
  const c2 = destinationPoint(drawStart, bearingDeg(legEnd, drawStart), dist);
  return cubicBezier(from, c1, c2, drawStart, BOW_STEPS);
}

export interface ProcedureOverlay {
  fixId: string;
  kind: 'holding' | 'procedureTurn';
  points: LatLon[];
}

/** Hold leg length in NM, LNM's order: published time first, else published distance, else default. */
function holdLegNm(wp: ResolvedProcedureWaypoint): number {
  if (wp.holdTimeMin !== null && wp.holdTimeMin > 0) return wp.holdTimeMin * HOLD_NM_PER_MINUTE;
  if (wp.distance !== null && wp.distance > 0) return wp.distance;
  return DEFAULT_HOLD_LEG_NM;
}

/**
 * LNM's procedure-turn symbol (processLegs PROCEDURE_TURN + paintProcedureTurnWithText): from the
 * fix along course-45 (left) / course+45 (right) for max(distance - 3.5, 1) NM, then 3 NM
 * parallel to the published course, a 180-degree turn of 1.5 NM diameter towards the turn side,
 * and a return leg 0.8 x 3 NM back. Returns the symbol points starting at the fix.
 */
function procedureTurnShape(
  fix: LatLon,
  outboundTrue: number,
  turn: 'L' | 'R',
  distanceNm: number | null
): { points: LatLon[]; turnPoint: LatLon; course45: number } {
  const side = turn === 'L' ? -1 : 1;
  const course45 = outboundTrue + side * 45;
  const extensionNm = Math.max((distanceNm ?? 0) - 3.5, 1);
  const turnPoint = destinationPoint(fix, course45, extensionNm);
  const segmentEnd = destinationPoint(turnPoint, outboundTrue, PT_SEGMENT_NM);
  const radiusNm = PT_SEGMENT_NM / 4;
  const centre = destinationPoint(segmentEnd, outboundTrue + side * 90, radiusNm);
  const arc: LatLon[] = [];
  for (let i = 1; i <= 9; i++) {
    // Half circle from segmentEnd round the front to the point abeam on the turn side.
    arc.push(destinationPoint(centre, outboundTrue - side * 90 + side * 20 * i, radiusNm));
  }
  const arcEnd = arc[arc.length - 1]!;
  const returnEnd = destinationPoint(arcEnd, outboundTrue + 180, PT_SEGMENT_NM * 0.8);
  return { points: [fix, turnPoint, segmentEnd, ...arc, returnEnd], turnPoint, course45 };
}

function buildOverlay(
  wp: ResolvedProcedureWaypoint,
  fix: LatLon,
  courseTrue: number | null
): ProcedureOverlay | null {
  if (courseTrue === null) return null;
  const turn = wp.turnDirection ?? 'R';
  const legNm = holdLegNm(wp);
  // LNM: straight segments legNm long, turn circles legNm / 2 in diameter.
  const points = createHoldingPattern(
    [fix.longitude, fix.latitude],
    courseTrue,
    legNm,
    turn,
    legNm / 4
  );
  return { fixId: wp.fixId, kind: 'holding', points: points.map(toLatLon) };
}

function toLatLon([lon, lat]: [number, number]): LatLon {
  return { latitude: lat, longitude: lon };
}

export interface ProcedurePathOptions {
  /** Where the drawing starts: the runway end for a SID. */
  start?: PathState;
  /** Runway elevation, so a SID's first climb leg is measured from the runway (LNM: altDiff / 600). */
  runwayElevationFt?: number;
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

  /**
   * Run from the current state to `end` the way LNM paints a leg: one straight line from the
   * previous leg's end, preceded only by the small published-turn hint when the leg has one.
   * Leaves the track pointing along the final straight segment unless `trackAfterDeg` says
   * otherwise (an intercept establishes the intercepted course, not the bearing flown to it).
   */
  const runTo = (
    end: LatLon,
    wp: ResolvedProcedureWaypoint,
    trackAfterDeg?: number,
    legStart?: LatLon
  ) => {
    if (!state) {
      append([end]);
      state = { position: end, trackDeg: trackAfterDeg ?? NaN };
      return;
    }
    const gap = legStart ? greatCircleNm(state.position, legStart) : 0;
    const lead =
      legStart && gap > 0.02
        ? gapJoin(state.position, state.trackDeg, legStart, end, wp)
        : Number.isNaN(state.trackDeg)
          ? []
          : publishedTurnHint(state.position, state.trackDeg, end, wp);
    append(lead);
    append([end]);
    const before = lead[lead.length - 1] ?? state.position;
    state = { position: end, trackDeg: trackAfterDeg ?? bearingDeg(before, end) };
  };

  /** Arrive at a resolved fix from the current state. */
  const arriveAtFix = (fix: LatLon, wp: ResolvedProcedureWaypoint) => runTo(fix, wp);

  /** Fly a heading from the current state for a length (LNM: `lastPos.endpoint(course, dist)`). */
  const flyHeading = (heading: number, lengthNm: number, wp: ResolvedProcedureWaypoint) => {
    if (!state) return;
    runTo(destinationPoint(state.position, heading, lengthNm), wp, heading);
  };

  /**
   * Reach a computed termination point (an intercept, a radial crossing, a DME ring crossing).
   * The target is always computed from the leg's *start* position - LNM intersects from the
   * previous leg's end point - and then drawn as a straight line from there.
   */
  const arriveAtTarget = (target: LatLon, trackAfterDeg: number, wp: ResolvedProcedureWaypoint) => {
    if (!state) return;
    runTo(target, wp, trackAfterDeg);
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
      let arcStart = state.position;
      if (term === 'AF' && center) {
        // LNM's correctedArc: an entry more than 0.5 NM off the published DME distance gets a
        // straight stub out to the ring, at the bearing it sits from the station.
        const rho = wp.rho ?? greatCircleNm(center, fix);
        if (Math.abs(rho - greatCircleNm(state.position, center)) > 0.5) {
          arcStart = destinationPoint(center, bearingDeg(center, state.position), rho);
          append([arcStart]);
        }
      }
      const arc = center
        ? arcAroundCenter(
            { position: arcStart, trackDeg: state.trackDeg },
            fix,
            center,
            wp.turnDirection
          )
        : [];
      if (arc.length > 0) {
        append(arc);
        const before = arc[arc.length - 2] ?? arcStart;
        state = { position: fix, trackDeg: bearingDeg(before, fix) };
        continue;
      }
      // No resolved center - fall through to the plain fix arrival below.
    }

    // CF: LNM's COURSE_TO_FIX block. The leg's own line runs along its published course into the
    // fix, starting `distance` (or 1 NM) back from it. A previous position more than 1 NM off
    // that line is joined by a 45-degree intercept onto it; a crossing past the fix or short of
    // the line's start, or a course reversal (over 150 degrees round), flies to the line's start
    // instead - and the painter bridges that gap with a bow when a turn is published.
    if (
      term === 'CF' &&
      state &&
      wp.resolved &&
      wp.latitude !== undefined &&
      wp.longitude !== undefined
    ) {
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      const courseTrue = trueCourse(wp.course, fix);
      if (courseTrue !== null) {
        const legNm = wp.distance !== null && wp.distance > 0 ? wp.distance : 1;
        const extended = destinationPoint(fix, courseTrue + 180, legNm);
        const offLine = crossTrackStatus(state.position, extended, courseTrue as Degrees);
        let legStart: LatLon | undefined;
        let intercept: LatLon | null = null;
        if (Math.abs(offLine.crossTrackNm) > 1) {
          // An initial fix has no course of its own: LNM aims it at the middle of this leg's line.
          const lastLegCourse = Number.isNaN(state.trackDeg)
            ? bearingDeg(state.position, destinationPoint(extended, courseTrue, legNm / 2))
            : state.trackDeg;
          const courseDiff = Math.abs(norm180(courseTrue - lastLegCourse));
          if (courseDiff < REVERSAL_DEG) {
            const candidates = [-45, 45]
              .map((cut) =>
                intersectRadials(
                  extended,
                  courseTrue as Degrees,
                  state!.position,
                  norm360(courseTrue + cut) as Degrees
                )
              )
              .filter((c): c is LatLon => c !== null)
              .sort(
                (a, b) => greatCircleNm(a, state!.position) - greatCircleNm(b, state!.position)
              );
            intercept = candidates[0] ?? null;
          }
          const farFromStart = greatCircleNm(extended, state.position) > 1;
          if (intercept) {
            const along = crossTrackStatus(intercept, extended, courseTrue as Degrees).alongTrackNm;
            if (along < 0) {
              legStart = extended; // BEFORE_START: fly to the start of the leg
              intercept = null;
            } else if (along > legNm) {
              // AFTER_END: fly to the fix; a published turn far from the line start bows to it
              if ((wp.turnDirection === 'L' || wp.turnDirection === 'R') && farFromStart) {
                legStart = extended;
              }
              intercept = null;
            }
          } else if (farFromStart) {
            legStart = extended;
          }
        }
        if (intercept) {
          runTo(intercept, wp);
          runTo(fix, wp);
        } else {
          runTo(fix, wp, undefined, legStart);
        }
        continue;
      }
    }

    // FC: from the fix along the published course for the published distance. LNM draws the leg
    // line from the previous position straight to that end point.
    if (term === 'FC' && wp.resolved && wp.latitude !== undefined && wp.longitude !== undefined) {
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      const courseTrue = trueCourse(wp.course, fix);
      if (courseTrue !== null && wp.distance !== null) {
        const end = destinationPoint(fix, courseTrue, wp.distance);
        if (!state) append([fix]);
        runTo(end, wp, courseTrue);
        continue;
      }
    }

    if (PLAIN_FLY_TO.has(term) || term === 'RF' || term === 'AF') {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      arriveAtFix({ latitude: wp.latitude, longitude: wp.longitude }, wp);
      continue;
    }

    if (term === 'PI') {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      arriveAtFix(fix, wp);
      const courseTrue = trueCourse(wp.course, fix);
      if (courseTrue === null) continue;
      const shape = procedureTurnShape(fix, courseTrue, wp.turnDirection ?? 'L', wp.distance);
      overlays.push({ fixId: wp.fixId, kind: 'procedureTurn', points: shape.points });
      // LNM draws the leg line fix -> turn point and hands the next leg a position 1.5 NM
      // further out along the same 45-degree line.
      append([shape.turnPoint]);
      state = {
        position: destinationPoint(shape.turnPoint, shape.course45, 1.5),
        trackDeg: shape.course45,
      };
      continue;
    }

    if (LOOPS_AT_FIX.has(term)) {
      if (!wp.resolved || wp.latitude === undefined || wp.longitude === undefined) continue;
      const fix = { latitude: wp.latitude, longitude: wp.longitude };
      arriveAtFix(fix, wp);
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
      const firstDepartureLeg = options.start !== undefined && out.length === 0;
      flyHeading(
        courseTrue ?? state.trackDeg,
        altitudeLegNm(wp, firstDepartureLeg, options.runwayElevationFt),
        wp
      );
      continue;
    }

    if (TO_DISTANCE.has(term)) {
      // LNM: FD runs from its own fix, CD/VD from the previous position; the ring is around the
      // recommended navaid (or the fix), and the line is only allowed to reach distance-to-
      // station + 4 x the DME distance. No crossing - the leg ends at the station itself.
      const fixPos =
        wp.resolved && wp.latitude !== undefined && wp.longitude !== undefined
          ? { latitude: wp.latitude, longitude: wp.longitude }
          : null;
      const from = term === 'FD' && fixPos ? fixPos : state.position;
      const center = recNavaidPosition(wp) ?? fixPos;
      if (!center || wp.distance === null) continue;
      const heading = trueCourse(wp.course, from) ?? state.trackDeg;
      const maxReachNm = greatCircleNm(from, center) + 4 * wp.distance;
      let target = lineCircleIntersection(
        from,
        heading as Degrees,
        center,
        wp.distance as NauticalMiles
      );
      if (target && greatCircleNm(from, target) > maxReachNm) target = null;
      arriveAtTarget(target ?? center, heading, wp);
      continue;
    }

    if (TO_RADIAL.has(term)) {
      // LNM: the course line starts 2 NM to the side a published turn would leave the aircraft
      // (right of track for a left turn), widened by 1.2x up to five times until the crossing
      // with the radial lands 1.5-200 NM from the station. No valid crossing - nothing is drawn.
      const heading = courseTrue ?? state.trackDeg;
      const navaid = recNavaidPosition(wp);
      const radialTrue = navaid ? trueCourse(wp.theta, navaid) : null;
      if (!navaid || radialTrue === null) continue;
      let offsetNm =
        wp.turnDirection === 'L'
          ? RADIAL_TURN_OFFSET_NM
          : wp.turnDirection === 'R'
            ? -RADIAL_TURN_OFFSET_NM
            : 0;
      let target: LatLon | null = null;
      let legStart = state.position;
      for (let attempt = 0; attempt < 5 && !target; attempt++) {
        const from =
          offsetNm === 0
            ? state.position
            : destinationPoint(
                state.position,
                heading + (offsetNm > 0 ? 90 : -90),
                Math.abs(offsetNm)
              );
        const crossing = intersectRadials(
          from,
          heading as Degrees,
          navaid,
          norm360(radialTrue) as Degrees
        );
        if (crossing) {
          const distFromNavaid = greatCircleNm(navaid, crossing);
          if (distFromNavaid > 1.5 && distFromNavaid < 200) {
            target = crossing;
            legStart = from;
          }
        }
        offsetNm *= 1.2;
      }
      if (target) runTo(target, wp, heading, legStart);
      continue;
    }

    if (TO_INTERCEPT.has(term)) {
      const heading = courseTrue ?? state.trackDeg;
      const from = state.position;

      const nextIndex = waypoints.findIndex((w, idx) => idx > i && w.resolved && w.course !== null);
      const next = nextIndex >= 0 ? waypoints[nextIndex] : undefined;
      const nextAnchor =
        next && next.latitude !== undefined && next.longitude !== undefined
          ? { latitude: next.latitude, longitude: next.longitude }
          : null;
      const nextCourseTrue = next && nextAnchor ? trueCourse(next.course, nextAnchor) : null;
      // The ray to intersect must point from the anchor toward where the leg is actually flown.
      // A departure-anchored leg (FM/VM) is flown *away* from its fix along its course; an
      // arrival-anchored leg (TF/CF/...) is flown *into* its fix, so the line to meet is the
      // inbound course extended back out from the fix - the reciprocal. (A crossing behind a
      // ray's start is correctly rejected as divergent, so the direction matters.)
      const nextRayDeg =
        next && nextCourseTrue !== null
          ? ARRIVAL_ANCHORED.has(next.pathTerminator)
            ? norm360(nextCourseTrue + 180)
            : norm360(nextCourseTrue)
          : null;

      let target: LatLon | null = null;
      if (nextAnchor && nextRayDeg !== null) {
        target = intersectRadials(from, heading as Degrees, nextAnchor, nextRayDeg as Degrees);
      }

      let resultTrackDeg = heading;
      let consumedNextIndex = -1;

      if (target && nextAnchor && nextCourseTrue !== null && nextRayDeg !== null && next) {
        // Re-clip the raw crossing to the next leg's own segment, the way atools'
        // processCourseInterceptLegs does, instead of drawing wherever the two infinite
        // courses happen to cross (which can overshoot far past the next leg entirely).
        const status = crossTrackStatus(target, nextAnchor, nextRayDeg as Degrees);
        if (ARRIVAL_ANCHORED.has(next.pathTerminator)) {
          // Along the reciprocal ray, positive is the approach side (a genuine intercept short
          // of the fix); negative is past the fix - an overshoot, clipped to the fix itself.
          if (status.alongTrackNm < 0) target = nextAnchor;
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

      arriveAtTarget(target, resultTrackDeg, wp);
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
      // If the preceding CI/VI already put us on this course ahead of the fix, the leg starts
      // from that intercept point (LNM: `next->line.setPos1(intersect)`) rather than jumping
      // back to the fix and drawing the same stretch twice.
      const onCourse = crossTrackStatus(state.position, anchor, anchorCourseTrue as Degrees);
      const alreadyOnCourse =
        Math.abs(onCourse.crossTrackNm) < 0.1 &&
        onCourse.alongTrackNm >= 0 &&
        onCourse.alongTrackNm <= lengthNm;
      append(alreadyOnCourse ? [end] : [anchor, end]);
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
  /** Which procedure this is; an approach ends on the runway, so no line continues to the airport. */
  kind: 'sid' | 'star' | 'approach';
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
      runwayElevationFt: departureEnd.elevationFt,
    });
    if (path.length > 0) {
      out.push({ via: parts.sid.name, path: [farEnd, ...path], missedPath, overlays, kind: 'sid' });
    }
  }
  for (const [kind, p] of [
    ['star', parts.star],
    ['approach', parts.approach],
  ] as const) {
    if (!p) continue;
    const { path, missedPath, overlays } = procedureGeometry(p.waypoints);
    if (path.length > 1) out.push({ via: p.name, path, missedPath, overlays, kind });
  }
  return out;
}
