import { describe, expect, it } from 'vitest';
import { magneticToTrue, trueToMagnetic } from '@/lib/magvar';
import type { Degrees } from '@/lib/utils/geomath';
import { crossTrackStatus } from '@/lib/utils/geomath';
import type { ResolvedProcedureWaypoint } from '@/types/navigation';
import { bearingDeg, destinationPoint, greatCircleNm, pathDistanceNm } from './geometry';
import { builtProcedurePaths, procedureGeometry, procedurePath } from './legGeometry';

const norm180 = (deg: number): number => (((deg % 360) + 540) % 360) - 180;

const wp = (over: Partial<ResolvedProcedureWaypoint>): ResolvedProcedureWaypoint => ({
  fixId: 'FIX',
  fixRegion: 'EH',
  fixType: 'E',
  pathTerminator: 'TF',
  course: null,
  distance: null,
  altitude: null,
  speed: null,
  speedDescriptor: null,
  turnDirection: null,
  recNavaid: null,
  recNavaidRegion: null,
  theta: null,
  rho: null,
  arcRadius: null,
  centerFix: null,
  centerFixRegion: null,
  verticalAngle: null,
  rnp: null,
  holdTimeMin: null,
  isMissedApproach: false,
  latitude: 0,
  longitude: 0,
  resolved: true,
  ...over,
});

// EHEH RW21, the SID that drew a full circle: straight ahead to a fix just past
// the runway, then a published right turn onto the next.
const RW21 = {
  name: '21',
  latitude: 51.45939,
  longitude: 5.38489,
  headingDeg: 212,
  lengthNm: 1.35,
};
const wood1s = [
  wp({
    fixId: 'EH597',
    pathTerminator: 'CF',
    course: 212,
    distance: 1,
    latitude: 51.4354,
    longitude: 5.358,
  }),
  wp({
    fixId: 'EH598',
    pathTerminator: 'CF',
    course: 341,
    turnDirection: 'R',
    latitude: 51.4827,
    longitude: 5.3319,
  }),
  wp({ fixId: 'EH556', latitude: 51.53, longitude: 5.28 }),
];

describe('procedurePath', () => {
  it('follows a close first fix without circling back', () => {
    const path = procedurePath(wood1s, {
      start: { position: { latitude: 51.44089, longitude: 5.36416 }, trackDeg: 212 },
    });
    const last = path[path.length - 1]!;
    expect(last.latitude).toBeCloseTo(51.53, 3);
    // A wrapped turn circle would nearly double the flown distance.
    const direct =
      greatCircleNm(path[0]!, { latitude: 51.4354, longitude: 5.358 }) +
      greatCircleNm(
        { latitude: 51.4354, longitude: 5.358 },
        { latitude: 51.4827, longitude: 5.3319 }
      ) +
      greatCircleNm({ latitude: 51.4827, longitude: 5.3319 }, last);
    expect(pathDistanceNm(path)).toBeLessThan(direct + 3);
    // The track never jumps: every turn is drawn as an arc.
    for (let i = 2; i < path.length; i++) {
      const a = bearingDeg(path[i - 2]!, path[i - 1]!);
      const b = bearingDeg(path[i - 1]!, path[i]!);
      const diff = Math.abs(a - b);
      expect(Math.min(diff, 360 - diff)).toBeLessThan(35);
    }
  });

  it('draws altitude legs to length on the published course and honours the turn after', () => {
    // Climb runway heading to 3000, then a published left turn direct to a fix behind-right,
    // the long way round.
    const legs = [
      wp({
        fixId: '',
        pathTerminator: 'VA',
        course: 210,
        resolved: false,
        altitude: { descriptor: '+', altitude1: 3000, altitude2: null },
      }),
      wp({
        fixId: 'BACK',
        pathTerminator: 'DF',
        turnDirection: 'L',
        latitude: 51.52,
        longitude: 5.45,
      }),
    ];
    const start = { position: { latitude: 51.44, longitude: 5.36 }, trackDeg: 212 };
    const path = procedurePath(legs, { start });
    // 3000 ft at 600 ft/nm (LNM's gradient, ours was 300 - half real): five miles straight,
    // on the published course exactly (LNM flies legTrueCourse(), never the previous track).
    expect(greatCircleNm(start.position, path[0]!)).toBeCloseTo(5, 0);
    expect(bearingDeg(start.position, path[0]!)).toBeCloseTo(
      magneticToTrue(210 as Degrees, start.position.latitude, start.position.longitude),
      0
    );
    // The published left turn is kept even though the fix lies to the right.
    const exitTrack = bearingDeg(path[1]!, path[2]!);
    const turned = ((exitTrack - 212 + 540) % 360) - 180;
    expect(turned).toBeLessThan(0);
    expect(path[path.length - 1]!.longitude).toBeCloseTo(5.45, 3);
  });

  it('draws fix-to-fix legs as straight lines with no synthetic fly-by arc (LNM paints leg.line as is)', () => {
    // LNM's paintProcedureSegment: a TF/CF/DF leg without a published turn direction is one
    // straight line from the previous leg's end to the fix. No turn radius is ever invented.
    const path = procedurePath([
      wp({ fixId: 'A', latitude: 52, longitude: 5 }),
      wp({ fixId: 'B', latitude: 52, longitude: 5.3 }),
      wp({ fixId: 'C', latitude: 51.8, longitude: 5.3 }),
    ]);
    expect(path).toEqual([
      { latitude: 52, longitude: 5 },
      { latitude: 52, longitude: 5.3 },
      { latitude: 51.8, longitude: 5.3 },
    ]);
  });

  it('marks a published turn with a small sub-NM hint, not a wide arc swinging past the fix', () => {
    // EHAM I36C SUGOL transition, real coordinates: SUGOL -> SPL (the VOR on the field) -> AM280
    // with a published right turn at SPL. LNM's paintProcedureTurn leaves 0.5 NM for a small
    // bezier at the fix and then runs straight; a 2 NM-radius tangent arc swung 2 NM east over
    // the airport before heading south-west, which is the loop that showed on the map.
    const SUGOL = { latitude: 52.525511111, longitude: 3.96735 };
    const SPL = { latitude: 52.332138889, longitude: 4.749888889 };
    const AM280 = { latitude: 52.24775, longitude: 4.59625 };
    const path = procedurePath([
      wp({ fixId: 'SUGOL', pathTerminator: 'IF', ...SUGOL }),
      wp({ fixId: 'SPL', ...SPL }),
      wp({ fixId: 'AM280', turnDirection: 'R', ...AM280 }),
    ]);
    const splIndex = path.findIndex(
      (p) =>
        Math.abs(p.latitude - SPL.latitude) < 1e-6 && Math.abs(p.longitude - SPL.longitude) < 1e-6
    );
    expect(splIndex).toBeGreaterThan(0);
    const after = path.slice(splIndex);
    // The hint stays within a mile of the fix, and the whole leg is barely longer than direct.
    for (const p of after)
      expect(greatCircleNm(SPL, p)).toBeLessThan(greatCircleNm(SPL, AM280) + 0.01);
    expect(Math.max(...after.slice(1, -1).map((p) => greatCircleNm(SPL, p)))).toBeLessThan(1);
    expect(pathDistanceNm(after)).toBeLessThan(greatCircleNm(SPL, AM280) + 0.6);
    // It still bends to the right of the inbound track, as published.
    const inbound = bearingDeg(SUGOL, SPL);
    const first = bearingDeg(SPL, after[1]!);
    expect(((first - inbound + 540) % 360) - 180).toBeGreaterThan(0);
  });

  it('measures the first SID climb from the runway elevation, unclamped (LNM: altDiff / 600)', () => {
    const legs = [
      wp({
        fixId: '',
        pathTerminator: 'CA',
        course: 212,
        resolved: false,
        altitude: { descriptor: '+', altitude1: 9000, altitude2: null },
      }),
    ];
    const start = { position: { latitude: 51.44, longitude: 5.36 }, trackDeg: 212 };
    // 9000 ft from a 1200 ft runway is 7800 ft, 13 NM at 600 ft/NM.
    const path = procedurePath(legs, { start, runwayElevationFt: 1200 });
    expect(greatCircleNm(start.position, path[0]!)).toBeCloseTo(13, 1);
    // Without the elevation the full altitude counts, and nothing caps it at 20 NM.
    const legsHigh = [
      wp({
        fixId: '',
        pathTerminator: 'CA',
        course: 212,
        resolved: false,
        altitude: { descriptor: '+', altitude1: 15000, altitude2: null },
      }),
    ];
    expect(greatCircleNm(start.position, procedurePath(legsHigh, { start })[0]!)).toBeCloseTo(
      25,
      1
    );
  });

  it('starts a STAR at its first fix with no synthetic entry', () => {
    const path = procedurePath([
      wp({ fixId: 'A', latitude: 52, longitude: 5 }),
      wp({ fixId: 'B', latitude: 51.8, longitude: 5.2 }),
    ]);
    expect(path[0]).toEqual({ latitude: 52, longitude: 5 });
    expect(path[path.length - 1]).toEqual({ latitude: 51.8, longitude: 5.2 });
  });

  it('draws a real constant-radius arc for an RF leg, not a straight turn', () => {
    const center = { latitude: 40, longitude: -80 };
    const radiusNm = 10;
    const start = destinationPoint(center, 0, radiusNm); // due north of center
    const fix = destinationPoint(center, 90, radiusNm); // due east of center
    const legs = [
      wp({
        fixId: 'ARC1',
        pathTerminator: 'RF',
        turnDirection: 'R',
        centerFix: 'CTR',
        centerFixRegion: 'ZZ',
        centerFixLatitude: center.latitude,
        centerFixLongitude: center.longitude,
        latitude: fix.latitude,
        longitude: fix.longitude,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 90 } });
    // A real arc stays on the circle; a straight chord would cut inside it.
    for (const p of path) {
      expect(greatCircleNm(center, p)).toBeCloseTo(radiusNm, 1);
    }
    expect(path.length).toBeGreaterThan(2);
  });

  it('draws a real DME arc for an AF leg, anchored on the recommended navaid', () => {
    const navaid = { latitude: 40, longitude: -80 };
    const radiusNm = 15;
    const start = destinationPoint(navaid, 0, radiusNm);
    const fix = destinationPoint(navaid, 90, radiusNm);
    const legs = [
      wp({
        fixId: 'ARC2',
        pathTerminator: 'AF',
        turnDirection: 'R',
        recNavaid: 'NAV',
        recNavaidRegion: 'ZZ',
        recNavaidLatitude: navaid.latitude,
        recNavaidLongitude: navaid.longitude,
        rho: radiusNm,
        latitude: fix.latitude,
        longitude: fix.longitude,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 90 } });
    for (const p of path) {
      expect(greatCircleNm(navaid, p)).toBeCloseTo(radiusNm, 1);
    }
  });

  it('crosses the real DME ring around the recommended navaid for a distance leg, not a flat guess from the start', () => {
    const navaid = { latitude: 40, longitude: -80 };
    const start = { latitude: 40 - 20 / 60, longitude: -80 }; // 20 NM south of the navaid
    const legs = [
      wp({
        fixId: '',
        pathTerminator: 'CD',
        course: null,
        distance: 25,
        recNavaid: 'NAV',
        recNavaidRegion: 'ZZ',
        recNavaidLatitude: navaid.latitude,
        recNavaidLongitude: navaid.longitude,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 0 } });
    const target = path[path.length - 1]!;
    expect(greatCircleNm(navaid, target)).toBeCloseTo(25, 1);
  });

  it('runs an FD leg from its own fix along its course to the DME ring (LNM: start = fixPos)', () => {
    // The previous leg ended 20 NM south of the navaid, but the FD leg is anchored on its own
    // fix 10 NM south of it; the ring crossing is computed along the course from that fix.
    const navaid = { latitude: 40, longitude: -80 };
    const prevEnd = destinationPoint(navaid, 180, 20);
    const fix = destinationPoint(navaid, 180, 10);
    const legs = [
      wp({
        fixId: 'FIXA',
        pathTerminator: 'FD',
        course: trueToMagnetic(0 as Degrees, fix.latitude, fix.longitude),
        distance: 25,
        recNavaid: 'NAV',
        recNavaidRegion: 'ZZ',
        recNavaidLatitude: navaid.latitude,
        recNavaidLongitude: navaid.longitude,
        ...fix,
      }),
    ];
    const path = procedurePath(legs, { start: { position: prevEnd, trackDeg: 0 } });
    const target = path[path.length - 1]!;
    expect(greatCircleNm(navaid, target)).toBeCloseTo(25, 1);
    expect(target.latitude).toBeGreaterThan(navaid.latitude); // crossed north of the station
  });

  it('draws nothing for a CD leg whose DME ring cannot be located (LNM leaves the leg line invalid)', () => {
    const legs = [
      wp({ fixId: '', pathTerminator: 'CD', course: null, distance: 5, resolved: false }),
    ];
    const path = procedurePath(legs, {
      start: { position: { latitude: 40, longitude: -80 }, trackDeg: 0 },
    });
    expect(path).toEqual([]);
  });

  it('runs an FC leg from its fix for the published distance along the published course', () => {
    const fix = { latitude: 40, longitude: -80 };
    const legs = [
      wp({
        fixId: 'FIXA',
        pathTerminator: 'FC',
        course: trueToMagnetic(90 as Degrees, fix.latitude, fix.longitude),
        distance: 5,
        ...fix,
      }),
    ];
    const path = procedurePath(legs);
    expect(path).toHaveLength(2);
    expect(path[0]).toEqual(fix);
    expect(greatCircleNm(fix, path[1]!)).toBeCloseTo(5, 1);
    expect(bearingDeg(fix, path[1]!)).toBeCloseTo(90, 0);
  });

  it('joins a CF leg from far off its course by a 45-degree intercept onto the course, not a direct line to the fix', () => {
    // LNM's COURSE_TO_FIX block: when the previous position is more than 1 NM off the leg's
    // inbound course line, it intersects a 45-degree radial from there with the course and
    // draws previous -> intercept -> fix.
    const prevStart = { latitude: 40, longitude: -80.5 };
    const prevEnd = { latitude: 40, longitude: -80 };
    const fix = { latitude: 41, longitude: -79 };
    const legs = [
      wp({ fixId: 'P', pathTerminator: 'IF', ...prevStart }),
      wp({ fixId: 'Q', ...prevEnd }),
      wp({
        fixId: 'F',
        pathTerminator: 'CF',
        course: trueToMagnetic(360 as Degrees, fix.latitude, fix.longitude),
        distance: 20,
        ...fix,
      }),
    ];
    const path = procedurePath(legs);
    expect(path).toHaveLength(4);
    const intercept = path[2]!;
    // On the course line through the fix, short of it, reached on a 45-degree cut.
    expect(Math.abs(crossTrackStatus(intercept, fix, 180 as Degrees).crossTrackNm)).toBeLessThan(
      0.1
    );
    expect(intercept.latitude).toBeLessThan(fix.latitude);
    expect(intercept.latitude).toBeGreaterThan(fix.latitude - 20 / 60);
    expect(bearingDeg(prevEnd, intercept)).toBeCloseTo(45, 0);
  });

  it('draws a course reversal onto a CF leg as a bow to the start of its course, not an intercept', () => {
    // Heading east, then a CF leg with a westbound course to a fix behind: LNM treats anything
    // over 150 degrees as a reversal, flies to the start of the course (fix + distance back)
    // and the painter connects the gap with a smooth bezier bow when a turn is published.
    const prevStart = { latitude: 40, longitude: -80.5 };
    const prevEnd = { latitude: 40, longitude: -80 };
    const fix = { latitude: 40.1, longitude: -80.5 };
    const legs = [
      wp({ fixId: 'P', pathTerminator: 'IF', ...prevStart }),
      wp({ fixId: 'Q', ...prevEnd }),
      wp({
        fixId: 'F',
        pathTerminator: 'CF',
        turnDirection: 'L',
        course: trueToMagnetic(270 as Degrees, fix.latitude, fix.longitude),
        distance: 10,
        ...fix,
      }),
    ];
    const path = procedurePath(legs);
    expect(path[path.length - 1]).toEqual(fix);
    const afterQ = path.slice(1);
    expect(afterQ.length).toBeGreaterThan(5); // the bow is sampled, not a single corner
    for (let i = 1; i < afterQ.length - 1; i++) {
      const a = bearingDeg(afterQ[i - 1]!, afterQ[i]!);
      const b = bearingDeg(afterQ[i]!, afterQ[i + 1]!);
      expect(Math.abs(((b - a + 540) % 360) - 180)).toBeLessThan(70);
    }
    // Reaches the start of the course line (10 NM east of the fix) before running in to the fix.
    const courseStart = destinationPoint(fix, 90, 10);
    expect(Math.min(...afterQ.map((p) => greatCircleNm(courseStart, p)))).toBeLessThan(1.2);
  });

  it('offsets a CR leg with a published turn 2 NM to the side before intercepting (LNM parallel line)', () => {
    // Like the plain CR case (station 6 NM to the right of the track this time, so the shifted
    // crossing still clears LNM's 1.5 NM minimum), but with a left turn published: LNM intersects
    // from a course line shifted 2 NM to the right (where a left turn onto course would leave the
    // aircraft) and starts the leg there.
    const start = { latitude: 40, longitude: -80 };
    const onTrack = destinationPoint(start, 100, 15);
    const navaid = destinationPoint(onTrack, 190, 6);
    const theta = trueToMagnetic(
      bearingDeg(navaid, onTrack) as Degrees,
      navaid.latitude,
      navaid.longitude
    );
    const legs = [
      wp({
        fixId: '',
        pathTerminator: 'CR',
        turnDirection: 'L',
        course: null,
        theta,
        recNavaid: 'NAV',
        recNavaidRegion: 'ZZ',
        recNavaidLatitude: navaid.latitude,
        recNavaidLongitude: navaid.longitude,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 100 } });
    const target = path[path.length - 1]!;
    // Still on the radial, but 2 NM right of the original track line.
    expect(
      Math.abs(norm180(bearingDeg(navaid, target) - bearingDeg(navaid, onTrack)))
    ).toBeLessThan(1.5);
    expect(crossTrackStatus(target, start, 100 as Degrees).crossTrackNm).toBeCloseTo(2, 0);
  });

  it('enters an AF arc by a straight stub out to the DME ring when the previous leg ended off it', () => {
    // LNM: if the entry position is more than 0.5 NM off the published rho, the arc starts at
    // the point on the ring in the direction of that position (correctedArc) and a straight
    // line leads there.
    const navaid = { latitude: 40, longitude: -80 };
    const radiusNm = 15;
    const start = destinationPoint(navaid, 0, 12); // 3 NM inside the ring, due north
    const fix = destinationPoint(navaid, 90, radiusNm);
    const legs = [
      wp({
        fixId: 'ARC2',
        pathTerminator: 'AF',
        turnDirection: 'R',
        recNavaid: 'NAV',
        recNavaidRegion: 'ZZ',
        recNavaidLatitude: navaid.latitude,
        recNavaidLongitude: navaid.longitude,
        rho: radiusNm,
        ...fix,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 90 } });
    const entry = path[0]!;
    expect(greatCircleNm(navaid, entry)).toBeCloseTo(radiusNm, 1);
    expect(bearingDeg(navaid, entry)).toBeCloseTo(0, 0);
    for (const p of path) expect(greatCircleNm(navaid, p)).toBeCloseTo(radiusNm, 1);
  });

  it("intercepts the next leg's real published course for a CI leg, not a fixed-length guess", () => {
    // The fix sits south of the eastbound track, so its 200-degree inbound course (approached
    // from the north-north-east) crosses the track *short* of the fix - a genuine intercept,
    // not an overshoot that would rightly be clipped to the fix itself.
    const start = { latitude: 40, longitude: -80 };
    const nextFix = { latitude: 39.8, longitude: -79.5 };
    const legs = [
      wp({ fixId: '', pathTerminator: 'CI', course: null }),
      wp({
        fixId: 'NEXT',
        pathTerminator: 'TF',
        course: 200,
        latitude: nextFix.latitude,
        longitude: nextFix.longitude,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 90 } });
    const nextCourseTrue = magneticToTrue(200 as Degrees, nextFix.latitude, nextFix.longitude);
    // The intercept point sits on the next leg's course line (and isn't the fix itself). It's
    // preceded by the turn arc onto it, so locate it by that property rather than by index.
    const onNextCourse = path.filter(
      (p) =>
        greatCircleNm(p, nextFix) > 0.01 &&
        Math.abs(crossTrackStatus(p, nextFix, nextCourseTrue).crossTrackNm) < 0.1
    );
    expect(onNextCourse.length).toBeGreaterThan(0);
  });

  it('intercepts the real published radial from the recommended navaid for a CR leg', () => {
    // A point 15 NM ahead on the flown track (heading 100 - 090/270 is the great-circle's own
    // latitude apex and must be avoided), with the navaid offset 3 NM to the side of it. The
    // navaid's own radial aimed back at that point crosses the track there, 3 NM from the
    // navaid - comfortably inside atools' accepted 1.5-200 NM intercept-distance window.
    const start = { latitude: 40, longitude: -80 };
    const onTrack = destinationPoint(start, 100, 15);
    const navaid = destinationPoint(onTrack, 190, 3);
    const radialTrueToOnTrack = bearingDeg(navaid, onTrack);
    const thetaMagnetic = trueToMagnetic(
      radialTrueToOnTrack as Degrees,
      navaid.latitude,
      navaid.longitude
    );
    const legs = [
      wp({
        fixId: '',
        pathTerminator: 'CR',
        course: null,
        theta: thetaMagnetic,
        recNavaid: 'NAV',
        recNavaidRegion: 'ZZ',
        recNavaidLatitude: navaid.latitude,
        recNavaidLongitude: navaid.longitude,
      }),
    ];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 100 } });
    const target = path[path.length - 1]!;
    expect(target.latitude).toBeCloseTo(onTrack.latitude, 2);
    expect(target.longitude).toBeCloseTo(onTrack.longitude, 2);
  });

  it('draws a course line for FM/VM instead of dropping the leg entirely', () => {
    const start = { latitude: 40, longitude: -80 };
    const legs = [wp({ fixId: '', pathTerminator: 'FM', course: null })];
    const path = procedurePath(legs, { start: { position: start, trackDeg: 90 } });
    expect(path.length).toBeGreaterThan(0);
  });

  it("clips a CI intercept to the next (FM) leg's own endpoint instead of overshooting to the raw course crossing", () => {
    // DAAG's ILS Z 23 missed approach, real coordinates: the CI leg's course crosses the FM
    // leg's published radial from ALR about 10 NM past ALR, but the FM leg itself only runs 3 NM
    // (no published distance -> atools' hardcoded fallback) from ALR along that radial. atools
    // clips the CI leg to the FM leg's own far end instead of drawing the full ~8 NM overshoot
    // to the raw crossing point - and the FM leg itself then contributes nothing further (it's
    // already been reached).
    const ALR = { latitude: 36.690997222, longitude: 3.215480556 };
    const legs = [
      wp({ fixId: '', pathTerminator: 'CI', course: 313.0, speedDescriptor: '-', speed: 190 }),
      wp({
        fixId: 'ALR',
        fixType: 'D',
        pathTerminator: 'FM',
        recNavaid: 'ALR',
        recNavaidRegion: 'DA',
        course: 343.0,
        altitude: { descriptor: '+', altitude1: 2470, altitude2: null },
        latitude: ALR.latitude,
        longitude: ALR.longitude,
      }),
    ];
    const start = { position: { latitude: 36.76301, longitude: 3.27615 }, trackDeg: 231 };
    const path = procedurePath(legs, { start });

    const fmCourseTrue = magneticToTrue(343 as Degrees, ALR.latitude, ALR.longitude);
    const fmEnd = destinationPoint(ALR, fmCourseTrue, 3);
    const last = path[path.length - 1]!;
    expect(last.latitude).toBeCloseTo(fmEnd.latitude, 2);
    expect(last.longitude).toBeCloseTo(fmEnd.longitude, 2);

    // The flown distance should be in the ballpark of start -> FM's own end (~8 NM), nowhere
    // near the ~10+ NM raw intersection the unclipped math would have overshot to.
    const flown = pathDistanceNm([start.position, ...path]);
    const direct = greatCircleNm(start.position, fmEnd);
    expect(flown).toBeLessThan(direct * 1.5);
  });
});

describe('procedureGeometry missed approach split', () => {
  it('keeps missed-approach legs out of the main path, in a separate missedPath that bridges from where it left off', () => {
    const fix = { latitude: 36.78157, longitude: 3.36414 };
    const legs = [
      wp({ fixId: 'FI23', pathTerminator: 'TF', latitude: fix.latitude, longitude: fix.longitude }),
      wp({ fixId: '', pathTerminator: 'CA', course: 231.0, isMissedApproach: true }),
      wp({ fixId: '', pathTerminator: 'CI', course: 313.0, isMissedApproach: true }),
    ];
    const { path, missedPath } = procedureGeometry(legs, {
      start: { position: fix, trackDeg: 231 },
    });

    // The main path has exactly the non-missed leg's fix - nothing from the missed legs leaked in.
    expect(path).toEqual([fix]);
    // The missed path bridges from that same point, then continues.
    expect(missedPath[0]).toEqual(fix);
    expect(missedPath.length).toBeGreaterThan(1);
  });
});

describe('procedureGeometry course-leg intercepts', () => {
  it('never doubles back on itself: the intercept is computed from the leg start, not from the end of a turn arc', () => {
    // DAAG I23 ZEM missed approach, real coordinates, with RW23 resolved to its real threshold.
    // The CA climb ends ~0.15 NM from ALR; the CI course (313) crosses ALR's 343 radial just
    // ahead of ALR. Computing that crossing from the end of a 2 NM-radius turn arc instead (which
    // has already swung 2.5 NM west, past the radial) put the crossing *behind* ALR, clipped it
    // back to ALR, and drew a ~150 degree reversal - the "bow" on the map. LNM intersects from
    // the previous leg's end point; so do we now.
    // The full published chain (ZEM transition through the missed approach), not just the tail:
    // the exact inbound track into RW23 decides whether the CI crossing lands on ALR's radial
    // ahead of ALR (a genuine intercept the following FM leg must *continue from*) or gets
    // clipped to ALR itself - both have to come out without a reversal.
    const ZEM = { latitude: 36.795, longitude: 3.570833333 };
    const CI23 = { latitude: 36.8017, longitude: 3.39725 };
    const FI23 = { latitude: 36.781575, longitude: 3.364141667 };
    const RW23 = { latitude: 36.7129725, longitude: 3.2515459 };
    const ALR = { latitude: 36.690997222, longitude: 3.215480556 };
    const legs = [
      wp({ fixId: 'ZEM', pathTerminator: 'IF', latitude: ZEM.latitude, longitude: ZEM.longitude }),
      wp({
        fixId: 'CI23',
        pathTerminator: 'CF',
        course: 271,
        latitude: CI23.latitude,
        longitude: CI23.longitude,
      }),
      wp({
        fixId: 'FI23',
        pathTerminator: 'CF',
        course: 231,
        latitude: FI23.latitude,
        longitude: FI23.longitude,
      }),
      wp({
        fixId: 'RW23',
        pathTerminator: 'CF',
        course: 231,
        latitude: RW23.latitude,
        longitude: RW23.longitude,
      }),
      wp({
        fixId: '',
        pathTerminator: 'CA',
        course: 231.0,
        altitude: { descriptor: '+', altitude1: 660, altitude2: null },
        isMissedApproach: true,
      }),
      wp({ fixId: '', pathTerminator: 'CI', course: 313.0, isMissedApproach: true }),
      wp({
        fixId: 'ALR',
        pathTerminator: 'FM',
        course: 343.0,
        latitude: ALR.latitude,
        longitude: ALR.longitude,
        isMissedApproach: true,
      }),
    ];
    const { missedPath } = procedureGeometry(legs);
    expect(missedPath.length).toBeGreaterThan(2);
    for (let i = 2; i < missedPath.length; i++) {
      const a = bearingDeg(missedPath[i - 2]!, missedPath[i - 1]!);
      const b = bearingDeg(missedPath[i - 1]!, missedPath[i]!);
      const turn = Math.abs(((((b - a) % 360) + 540) % 360) - 180);
      expect(turn).toBeLessThan(120);
    }
  });
});

describe('procedureGeometry overlays', () => {
  it('produces a holding-pattern overlay anchored at the real fix for an HM leg', () => {
    const fix = { latitude: 40, longitude: -80 };
    const legs = [
      wp({
        fixId: 'HOLD',
        pathTerminator: 'HM',
        course: 90,
        turnDirection: 'R',
        distance: 5,
        latitude: fix.latitude,
        longitude: fix.longitude,
      }),
    ];
    const { overlays } = procedureGeometry(legs, {
      start: { position: { latitude: 39.8, longitude: -80 }, trackDeg: 0 },
    });
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({ fixId: 'HOLD', kind: 'holding' });
    for (const p of overlays[0]!.points) {
      expect(greatCircleNm(fix, p)).toBeLessThan(10);
    }
  });

  it('turns the short way between two close fixes instead of looping almost a full circle', () => {
    // DAAG I23 ZEM approach, real coordinates: CI23 -> FI23 is only ~2 NM, needing a ~40 degree
    // left turn. The left-turn circle at the default 2 NM radius has FI23 inside it (no tangent
    // solution), so only the wrong-direction right turn produces a result there - a valid but
    // ~330 degree sweep. A 1 NM radius fits the correct left turn in a clean ~60 degree sweep;
    // the fallback must prefer that, not stop at the first (looping) non-empty result.
    const ZEM = { latitude: 36.795, longitude: 3.570833333 };
    const CI23 = { latitude: 36.8017, longitude: 3.39725 };
    const FI23 = { latitude: 36.781575, longitude: 3.364141667 };
    const legs = [
      wp({ fixId: 'ZEM', pathTerminator: 'IF', latitude: ZEM.latitude, longitude: ZEM.longitude }),
      wp({
        fixId: 'CI23',
        pathTerminator: 'CF',
        course: 271.0,
        latitude: CI23.latitude,
        longitude: CI23.longitude,
      }),
      wp({
        fixId: 'FI23',
        pathTerminator: 'CF',
        course: 231.0,
        latitude: FI23.latitude,
        longitude: FI23.longitude,
      }),
    ];
    const path = procedurePath(legs);
    const direct = greatCircleNm(CI23, FI23);
    // A real turn adds a little distance over direct; a near-full-circle loop would add many
    // times the direct distance.
    const ci23Index = path.findIndex(
      (p) =>
        Math.abs(p.latitude - CI23.latitude) < 1e-6 && Math.abs(p.longitude - CI23.longitude) < 1e-6
    );
    const flown = pathDistanceNm(path.slice(ci23Index));
    expect(flown).toBeLessThan(direct * 2);
  });

  it('turns the short way on a sub-1-NM leg, where even a 0.5 NM radius is still too big', () => {
    // DAAG I27 ZEM approach, real coordinates: D090J -> CF27 is only 0.63 NM, needing a turn
    // onto a course nearly 45 degrees off the inbound track. Even the smallest of the old fixed
    // radii (2, 1, 0.5 NM) has the fix sitting inside the correct-direction circle; only a
    // sub-0.3 NM radius finds a clean short turn instead of the wrong-direction ~330 degree one.
    const ZEM = { latitude: 36.795, longitude: 3.570833333 };
    const D090J = { latitude: 36.686027778, longitude: 3.41635 };
    const CF27 = { latitude: 36.686361111, longitude: 3.403302778 };
    const legs = [
      wp({ fixId: 'ZEM', pathTerminator: 'IF', latitude: ZEM.latitude, longitude: ZEM.longitude }),
      wp({
        fixId: 'D090J',
        pathTerminator: 'CF',
        course: 227.0,
        latitude: D090J.latitude,
        longitude: D090J.longitude,
      }),
      wp({
        fixId: 'CF27',
        pathTerminator: 'CF',
        course: 270.0,
        latitude: CF27.latitude,
        longitude: CF27.longitude,
      }),
    ];
    const path = procedurePath(legs);
    const direct = greatCircleNm(D090J, CF27);
    const d090jIndex = path.findIndex(
      (p) =>
        Math.abs(p.latitude - D090J.latitude) < 1e-6 &&
        Math.abs(p.longitude - D090J.longitude) < 1e-6
    );
    const flown = pathDistanceNm(path.slice(d090jIndex));
    expect(flown).toBeLessThan(direct * 3);
  });

  it('sizes a hold like LNM: 3.5 NM of leg per minute, turn radius a quarter of the leg', () => {
    const fix = { latitude: 40, longitude: -80 };
    const legs = [
      wp({
        fixId: 'HOLD',
        pathTerminator: 'HM',
        course: trueToMagnetic(360 as Degrees, fix.latitude, fix.longitude),
        turnDirection: 'R',
        holdTimeMin: 1,
        ...fix,
      }),
    ];
    const { overlays } = procedureGeometry(legs);
    const points = overlays[0]!.points;
    // Straight legs 3.5 NM, turn radius 0.875 NM: the apex of the far turn sits a radius past
    // the leg end and a radius to the side, about 4.5 NM from the fix.
    const apex = (legNm: number) => Math.hypot(legNm * 1.25, legNm / 4);
    expect(Math.max(...points.map((p) => greatCircleNm(fix, p)))).toBeCloseTo(apex(3.5), 1);
    // Published distance is used when there is no time.
    const byDistance = procedureGeometry([wp({ ...legs[0]!, holdTimeMin: null, distance: 6 })]);
    expect(
      Math.max(...byDistance.overlays[0]!.points.map((p) => greatCircleNm(fix, p)))
    ).toBeCloseTo(apex(6), 1);
  });

  it('shapes a procedure turn like LNM: 45-degree outbound, 3 NM straight, 180-degree turn, return', () => {
    // LNM processLegs + paintProcedureTurnWithText: from the fix along course-45 (left turn)
    // for max(distance - 3.5, 1) NM, then 3 NM parallel to the published course, a 180-degree
    // turn of 1.5 NM diameter towards the turn side, and a return leg 0.8 x 3 NM back.
    const fix = { latitude: 40, longitude: -80 };
    const outboundTrue = 180;
    const legs = [
      wp({
        fixId: 'PT',
        pathTerminator: 'PI',
        course: trueToMagnetic(outboundTrue as Degrees, fix.latitude, fix.longitude),
        turnDirection: 'L',
        distance: 10,
        ...fix,
      }),
    ];
    const { path, overlays } = procedureGeometry(legs);
    const pts = overlays[0]!.points;
    expect(pts[0]).toEqual(fix);
    const p1 = pts[1]!;
    expect(greatCircleNm(fix, p1)).toBeCloseTo(6.5, 1);
    expect(bearingDeg(fix, p1)).toBeCloseTo(outboundTrue - 45, 0);
    const p2 = pts[2]!;
    expect(greatCircleNm(p1, p2)).toBeCloseTo(3, 1);
    expect(bearingDeg(p1, p2)).toBeCloseTo(outboundTrue, 0);
    // The arc ends 1.5 NM to the left of p2, every sample 0.75 NM from the arc centre.
    const arcEnd = destinationPoint(p2, outboundTrue - 90, 1.5);
    const centre = destinationPoint(p2, outboundTrue - 90, 0.75);
    const arcEndIndex = pts.findIndex((p) => greatCircleNm(p, arcEnd) < 0.05);
    expect(arcEndIndex).toBeGreaterThan(3);
    for (const p of pts.slice(3, arcEndIndex + 1)) {
      expect(greatCircleNm(centre, p)).toBeCloseTo(0.75, 1);
    }
    const ret = pts[pts.length - 1]!;
    expect(bearingDeg(arcEnd, ret)).toBeCloseTo(outboundTrue - 180, 0);
    expect(greatCircleNm(arcEnd, ret)).toBeCloseTo(2.4, 1);
    // The drawn leg itself runs fix -> turn point, and the next leg picks up 1.5 NM past it.
    expect(path).toEqual([fix, p1]);
  });

  it('produces a procedure-turn overlay anchored at the real fix for a PI leg', () => {
    const fix = { latitude: 40, longitude: -80 };
    const legs = [
      wp({
        fixId: 'PT',
        pathTerminator: 'PI',
        course: 90,
        turnDirection: 'L',
        latitude: fix.latitude,
        longitude: fix.longitude,
      }),
    ];
    const { overlays } = procedureGeometry(legs, {
      start: { position: { latitude: 39.8, longitude: -80 }, trackDeg: 0 },
    });
    expect(overlays).toHaveLength(1);
    expect(overlays[0]).toMatchObject({ fixId: 'PT', kind: 'procedureTurn' });
  });
});

describe('builtProcedurePaths', () => {
  it('builds the SID from the runway far end and names it by its via', () => {
    const hints = builtProcedurePaths(
      { sid: { type: 'SID', name: 'WOOD1S', runway: 'RW21', transition: null, waypoints: wood1s } },
      RW21
    );
    expect(hints).toHaveLength(1);
    // The runway elevation reaches the climb math.
    const climb = [
      wp({
        fixId: '',
        pathTerminator: 'CA',
        course: 212,
        resolved: false,
        altitude: { descriptor: '+', altitude1: 3000, altitude2: null },
      }),
    ];
    const low = builtProcedurePaths(
      { sid: { type: 'SID', name: 'X', runway: 'RW21', transition: null, waypoints: climb } },
      { ...RW21, elevationFt: 0 }
    )[0]!.path;
    const high = builtProcedurePaths(
      { sid: { type: 'SID', name: 'X', runway: 'RW21', transition: null, waypoints: climb } },
      { ...RW21, elevationFt: 1800 }
    )[0]!.path;
    expect(greatCircleNm(low[0]!, low[1]!)).toBeCloseTo(5, 1);
    expect(greatCircleNm(high[0]!, high[1]!)).toBeCloseTo(2, 1);
    expect(hints[0]!.via).toBe('WOOD1S');
    expect(hints[0]!.kind).toBe('sid');
    // Starts at the far end of the runway, about its length from the threshold.
    expect(greatCircleNm(RW21, hints[0]!.path[0]!)).toBeCloseTo(1.35, 1);
  });
});
