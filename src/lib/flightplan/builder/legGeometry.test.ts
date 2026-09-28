import { describe, expect, it } from 'vitest';
import type { ResolvedProcedureWaypoint } from '@/types/navigation';
import { bearingDeg, greatCircleNm, pathDistanceNm } from './geometry';
import { builtProcedurePaths, procedurePath } from './legGeometry';

const wp = (over: Partial<ResolvedProcedureWaypoint>): ResolvedProcedureWaypoint => ({
  fixId: 'FIX',
  fixRegion: 'EH',
  fixType: 'E',
  pathTerminator: 'TF',
  course: null,
  distance: null,
  altitude: null,
  speed: null,
  turnDirection: null,
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
    // 3000 ft at 300 ft/nm: ten miles straight before anything else.
    expect(greatCircleNm(start.position, path[0]!)).toBeCloseTo(10, 0);
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
