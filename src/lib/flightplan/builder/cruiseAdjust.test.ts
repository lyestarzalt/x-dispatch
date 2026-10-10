import { describe, expect, it } from 'vitest';
import type { ResolvedProcedure } from '@/types/navigation';
import {
  adjustCruiseAltitudeFt,
  cruiseBand,
  cruiseProblem,
  describeCruiseIssue,
  fitCruiseToBand,
  planIsEastbound,
  procedureFloorFt,
} from './cruiseAdjust';

const open = { minFt: null, maxFt: null };
const upper = { minFt: 24500, maxFt: 46000 };

describe('adjustCruiseAltitudeFt', () => {
  it('rounds up to odd thousands eastbound and even westbound', () => {
    expect(adjustCruiseAltitudeFt(35000, open, true)).toBe(35000);
    expect(adjustCruiseAltitudeFt(35000, open, false)).toBe(36000);
    expect(adjustCruiseAltitudeFt(34500, open, true)).toBe(35000);
    expect(adjustCruiseAltitudeFt(34500, open, false)).toBe(36000);
  });

  it('lifts a cruise under the floor onto the first legal level', () => {
    expect(adjustCruiseAltitudeFt(18000, upper, true)).toBe(25000);
    expect(adjustCruiseAltitudeFt(18000, upper, false)).toBe(26000);
  });

  it('drops a cruise over the ceiling onto the highest legal level', () => {
    expect(adjustCruiseAltitudeFt(49000, upper, true)).toBe(45000);
    expect(adjustCruiseAltitudeFt(49000, upper, false)).toBe(46000);
    expect(adjustCruiseAltitudeFt(46000, { minFt: null, maxFt: 46000 }, true)).toBe(45000);
  });

  it('keeps the clamped value when the band is too narrow for the rule', () => {
    expect(adjustCruiseAltitudeFt(30000, { minFt: 35500, maxFt: 36500 }, false)).toBe(36000);
    expect(adjustCruiseAltitudeFt(30000, { minFt: 35500, maxFt: 36500 }, true)).toBe(35500);
  });

  it('starts from the floor when there is no cruise yet', () => {
    expect(adjustCruiseAltitudeFt(null, upper, true)).toBe(25000);
  });
});

describe('cruiseProblem', () => {
  it('names the side of the band or the parity', () => {
    expect(cruiseProblem(18000, upper, true)).toBe('belowFloor');
    expect(cruiseProblem(49000, upper, true)).toBe('aboveCeiling');
    expect(cruiseProblem(36000, upper, true)).toBe('parity');
    expect(cruiseProblem(35000, upper, true)).toBeNull();
    expect(cruiseProblem(null, upper, true)).toBeNull();
  });
});

describe('cruiseBand and procedureFloorFt', () => {
  const proc = (constraints: Array<[string, number, number?]>) =>
    ({
      waypoints: constraints.map(([descriptor, altitude1, altitude2]) => ({
        altitude: { descriptor, altitude1, altitude2: altitude2 ?? null },
      })),
    }) as unknown as ResolvedProcedure;

  it('takes the highest at-or-above constraint across the procedures', () => {
    expect(procedureFloorFt({})).toBeNull();
    expect(
      procedureFloorFt({
        sid: proc([
          ['+', 5000],
          ['-', 9000],
        ]),
      })
    ).toBe(5000);
    expect(procedureFloorFt({ sid: proc([['@', 7000]]), star: proc([['B', 11000, 9000]]) })).toBe(
      9000
    );
  });

  it('raises the airway floor with the procedure floor', () => {
    expect(cruiseBand(upper, 30000)).toEqual({ minFt: 30000, maxFt: 46000 });
    expect(cruiseBand(upper, 5000)).toEqual(upper);
    expect(cruiseBand(open, 5000)).toEqual({ minFt: 5000, maxFt: null });
  });
});

describe('fitCruiseToBand', () => {
  it('moves the suggestion inside the route band on the right parity', () => {
    // A jet suggestion of FL410 on a route of low airways capped at FL250, westbound.
    expect(fitCruiseToBand(41000, { minFt: null, maxFt: 25000 }, false)).toBe(24000);
    // A low suggestion on upper airways, eastbound.
    expect(fitCruiseToBand(9000, { minFt: 24500, maxFt: 46000 }, true)).toBe(25000);
    expect(fitCruiseToBand(36000, { minFt: 24500, maxFt: 46000 }, false)).toBe(36000);
  });

  it('leaves the suggestion alone when no level fits the route', () => {
    expect(fitCruiseToBand(41000, { minFt: 29000, maxFt: 25000 }, false)).toBe(41000);
  });
});

describe('describeCruiseIssue', () => {
  it('names both airways when no level fits the route, and offers nothing to adjust to', () => {
    const issue = describeCruiseIssue(
      25000,
      { minFt: 29000, maxFt: 25000 },
      { floor: 'UL28', ceiling: 'L10' },
      false
    );
    expect(issue).toEqual({
      kind: 'conflict',
      low: 'L10',
      ceilingFt: 25000,
      high: 'UL28',
      floorFt: 29000,
    });
  });

  it('names the airway behind a floor or ceiling the cruise is outside of', () => {
    expect(
      describeCruiseIssue(40000, { minFt: null, maxFt: 25000 }, { ceiling: 'L10' }, false)
    ).toEqual({ kind: 'aboveCeiling', airway: 'L10', ceilingFt: 25000 });
    expect(describeCruiseIssue(20000, { minFt: 29000, maxFt: null }, {}, false)).toEqual({
      kind: 'belowFloor',
      airway: null,
      floorFt: 29000,
    });
  });

  it('falls back to the odd-or-even rule and is quiet when the cruise fits', () => {
    expect(describeCruiseIssue(35000, { minFt: null, maxFt: null }, {}, false)).toEqual({
      kind: 'parity',
      eastbound: false,
    });
    expect(describeCruiseIssue(36000, { minFt: null, maxFt: null }, {}, false)).toBeNull();
    expect(describeCruiseIssue(null, { minFt: 29000, maxFt: 25000 }, {}, false)).toBeNull();
  });
});

describe('planIsEastbound', () => {
  it('uses the magnetic course halfway along the route', () => {
    expect(
      planIsEastbound({ latitude: 52.3, longitude: 4.8 }, { latitude: 50, longitude: 8.6 })
    ).toBe(true);
    expect(
      planIsEastbound({ latitude: 50, longitude: 8.6 }, { latitude: 52.3, longitude: 4.8 })
    ).toBe(false);
    // Just west of due south: past 180 magnetic, so even levels.
    expect(
      planIsEastbound({ latitude: 52.3, longitude: 4.8 }, { latitude: 43, longitude: 3.2 })
    ).toBe(false);
  });
});
