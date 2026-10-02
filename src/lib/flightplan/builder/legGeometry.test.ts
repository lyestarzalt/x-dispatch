import { describe, expect, it } from 'vitest';
import { magneticToTrue, trueToMagnetic } from '@/lib/magvar';
import type { Degrees } from '@/lib/utils/geomath';
import { crossTrackStatus } from '@/lib/utils/geomath';
import type { ResolvedProcedureWaypoint } from '@/types/navigation';
import { bearingDeg, destinationPoint, greatCircleNm, pathDistanceNm } from './geometry';
import { builtProcedurePaths, procedureGeometry, procedurePath } from './legGeometry';

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
    // 3000 ft at 600 ft/nm (LNM's gradient, ours was 300 - half real): five miles straight.
    expect(greatCircleNm(start.position, path[0]!)).toBeCloseTo(5, 0);
    expect(bearingDeg(start.position, path[0]!)).toBeCloseTo(212, 0);
    // The published left turn is kept even though the fix lies to the right.
    const exitTrack = bearingDeg(path[1]!, path[2]!);
    const turned = ((exitTrack - 212 + 540) % 360) - 180;
    expect(turned).toBeLessThan(0);
    expect(path[path.length - 1]!.longitude).toBeCloseTo(5.45, 3);
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
        pathTerminator: 'FD',
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

  it("intercepts the next leg's real published course for a CI leg, not a fixed-length guess", () => {
    const start = { latitude: 40, longitude: -80 };
    const nextFix = { latitude: 40.2, longitude: -79.5 };
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
    const interceptPoint = path[0]!;
    const nextCourseTrue = magneticToTrue(200 as Degrees, nextFix.latitude, nextFix.longitude);
    const status = crossTrackStatus(interceptPoint, nextFix, nextCourseTrue);
    expect(Math.abs(status.crossTrackNm)).toBeLessThan(0.1);
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
    expect(hints[0]!.via).toBe('WOOD1S');
    // Starts at the far end of the runway, about its length from the threshold.
    expect(greatCircleNm(RW21, hints[0]!.path[0]!)).toBeCloseTo(1.35, 1);
  });
});
