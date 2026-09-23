import { describe, expect, it } from 'vitest';
import type { FMSFlightPlan } from '@/types/fms';
import type { ResolvedProcedure } from '@/types/navigation';
import { composePlan, matchProcedure, proceduresForRunway } from './procedures';

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
    expect(plan.waypoints[3]?.via).toBe('UNOKO1A');
    expect(plan.departure.sid).toBe('ARNEM2S');
    expect(plan.arrival.star).toBe('UNOKO1A');
    expect(plan.arrival.starTransition).toBe('UNOKO');
  });

  it('leaves the plan untouched with no procedures', () => {
    expect(composePlan(base, {}).waypoints).toEqual(base.waypoints);
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
