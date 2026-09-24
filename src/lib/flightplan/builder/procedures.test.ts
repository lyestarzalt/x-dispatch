import { describe, expect, it } from 'vitest';
import type { FMSFlightPlan } from '@/types/fms';
import type { ResolvedProcedure } from '@/types/navigation';
import {
  composePlan,
  matchProcedure,
  planForFile,
  proceduresForRunway,
  sidFirstTurn,
  sidInitialClimbNm,
} from './procedures';

const base: FMSFlightPlan = {
  version: 1100,
  departure: { icao: 'EHAM', runway: '36L' },
  arrival: { icao: 'EDDF', runway: '25L' },
  waypoints: [
    { type: 1, id: 'EHAM', via: 'ADEP', altitude: 0, latitude: 52.3, longitude: 4.76 },
    { type: 11, id: 'ARNEM', via: 'DRCT', altitude: 29000, latitude: 51.98, longitude: 5.79 },
    { type: 11, id: 'UNOKO', via: 'UL620', altitude: 29000, latitude: 50.5, longitude: 8.0 },
    { type: 1, id: 'EDDF', via: 'ADES', altitude: 0, latitude: 50.03, longitude: 8.57 },
  ],
};

const wp = (
  fixId: string,
  lat: number,
  lon: number,
  extra: Partial<ResolvedProcedure['waypoints'][number]> = {}
) => ({
  fixId,
  fixRegion: 'EH',
  fixType: 'E' as const,
  pathTerminator: 'TF' as const,
  course: null,
  distance: null,
  altitude: null,
  speed: null,
  turnDirection: null,
  latitude: lat,
  longitude: lon,
  resolved: true,
  ...extra,
});

const sid: ResolvedProcedure = {
  type: 'SID',
  name: 'ARNEM2S',
  runway: '36L',
  transition: null,
  waypoints: [
    wp('RW36L', 52.31, 4.76, { fixType: 'C' }),
    wp('EH020', 52.2, 5.0, { altitude: { descriptor: '+', altitude1: 60, altitude2: null } }),
    wp('ARNEM', 51.98, 5.79),
  ],
};

const star: ResolvedProcedure = {
  type: 'STAR',
  name: 'UNOKO1A',
  runway: null,
  transition: 'UNOKO',
  waypoints: [
    wp('UNOKO', 50.5, 8.0),
    wp('ROLIS', 50.3, 8.2),
    wp('LOST', 0, 0, { resolved: false }),
  ],
};

describe('composePlan', () => {
  it('stitches SID and STAR around the enroute legs without repeating join fixes', () => {
    const plan = composePlan(base, { sid, star });
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'EH020',
      'ARNEM',
      'UNOKO',
      'ROLIS',
      'EDDF',
    ]);
    expect(plan.waypoints[1]?.via).toBe('ARNEM2S');
    expect(plan.waypoints[1]?.altitude).toBe(6000);
    expect(plan.waypoints[1]?.constraintLabel).toBe('FL60A');
    expect(plan.waypoints[2]?.constraintLabel).toBe('');
    expect(plan.waypoints[3]?.via).toBe('UNOKO1A');
    expect(plan.departure.sid).toBe('ARNEM2S');
    expect(plan.arrival.star).toBe('UNOKO1A');
    expect(plan.arrival.starTransition).toBe('UNOKO');
  });

  it('draws only legs that fly to their fix, and reads the initial climb from course legs', () => {
    // Le Luc GILON1: climb on course to 8.5 DME from LUC, turn left back to LUC, then GILON.
    const gilon: ResolvedProcedure = {
      type: 'SID',
      name: 'GILON1',
      runway: 'RW09',
      transition: null,
      waypoints: [
        wp('', 0, 0, { pathTerminator: 'CD', distance: 8.5, resolved: false }),
        wp('LUC', 43.38, 6.39, { fixType: 'V', pathTerminator: 'CF', turnDirection: 'L' }),
        wp('GILON', 43.44, 6.12),
        wp('LUC', 43.38, 6.39, { fixType: 'V', pathTerminator: 'FD', distance: 4 }),
      ],
    };
    const plan = composePlan(base, { sid: gilon });
    // The trailing FD leg only names LUC as its DME source, so LUC is not flown to again.
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'LUC',
      'GILON',
      'ARNEM',
      'UNOKO',
      'EDDF',
    ]);
    expect(sidInitialClimbNm(gilon, 1.5)).toBeCloseTo(7.75, 2);
    expect(sidInitialClimbNm(sid)).toBeUndefined();
    expect(sidFirstTurn(gilon)).toBe('L');
  });

  it('leaves the plan untouched with no procedures', () => {
    expect(composePlan(base, {}).waypoints).toEqual(base.waypoints);
  });

  it('leaves procedure fixes out of the file, naming the procedures instead', () => {
    const file = planForFile(base, { sid, star });
    // ARNEM is the SID exit and UNOKO the STAR entry; X-Plane adds both when it loads the procedures.
    expect(file.waypoints.map((w) => w.id)).toEqual(['EHAM', 'EDDF']);
    expect(planForFile(base, { sid }).waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'UNOKO',
      'EDDF',
    ]);
    expect(file.departure.sid).toBe('ARNEM2S');
    expect(file.arrival.star).toBe('UNOKO1A');
    expect(file.arrival.starTransition).toBe('UNOKO');
  });

  it('fills the runway from the procedure when the user left it open', () => {
    const open: FMSFlightPlan = {
      ...base,
      departure: { icao: 'EHAM' },
      arrival: { icao: 'EDDF' },
    };
    const file = planForFile(open, { sid, star: { ...star, runway: 'RW25L' } });
    expect(file.departure.runway).toBe('36L');
    expect(file.arrival.runway).toBe('25L');
    expect(
      planForFile(open, { sid: { ...sid, runway: 'RW36B' } }).departure.runway
    ).toBeUndefined();
  });

  it('drops enroute fixes that would double back over the SID or STAR', () => {
    const doubled: FMSFlightPlan = {
      ...base,
      waypoints: [
        base.waypoints[0]!,
        { type: 3, id: 'SPL', via: 'DRCT', altitude: 0, latitude: 52.33, longitude: 4.75 },
        base.waypoints[1]!,
        base.waypoints[2]!,
        { type: 3, id: 'FFM', via: 'DRCT', altitude: 0, latitude: 50.05, longitude: 8.64 },
        base.waypoints[3]!,
      ],
    };
    const plan = composePlan(doubled, { sid, star });
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'EHAM',
      'EH020',
      'ARNEM',
      'UNOKO',
      'ROLIS',
      'EDDF',
    ]);
  });
});

describe('procedure selection', () => {
  const variants: ResolvedProcedure[] = [
    { ...sid, runway: '36L' },
    { ...sid, runway: '18C' },
    { ...sid, runway: 'RW36B', transition: 'NORKU' },
  ];

  it('filters by runway and understands the B suffix', () => {
    expect(proceduresForRunway(variants, '36L').map((p) => p.runway)).toEqual(['36L', 'RW36B']);
    expect(proceduresForRunway(variants, undefined)).toHaveLength(3);
  });

  it('matches a choice to the variant for the chosen runway', () => {
    const picked = matchProcedure(variants, { name: 'ARNEM2S', transition: null }, '18C');
    expect(picked?.runway).toBe('18C');
    expect(matchProcedure(variants, undefined, '18C')).toBeUndefined();
  });
});
