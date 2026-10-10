import { describe, expect, it } from 'vitest';
import type { ResolvedProcedure } from '@/types/navigation';
import {
  adjustCruiseAltitudeFt,
  cruiseBand,
  cruiseProblem,
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
