import { describe, expect, it } from 'vitest';
import type { FMSFlightPlan, FMSWaypoint } from '@/types/fms';
import { draftFromFms, routeTextFromFms } from './fmsDraft';

const fix = (id: string, via: string, altitude = 31000, type: FMSWaypoint['type'] = 11) =>
  ({ type, id, via, altitude, latitude: 40, longitude: -3 }) as FMSWaypoint;

const plan: FMSFlightPlan = {
  version: 1100,
  cycle: '2609',
  departure: { icao: 'LEMD', runway: '36L', sid: 'NAND3N', sidTransition: 'NANDO' },
  arrival: { icao: 'LEPA', runway: '24L', star: 'GODO4P', starTransition: 'GODOX' },
  waypoints: [
    { type: 1, id: 'LEMD', via: 'ADEP', altitude: 1998, latitude: 40.47, longitude: -3.56 },
    fix('NANDO', 'DRCT'),
    fix('FENXE', 'T257'),
    fix('MABUX', 'T257'),
    fix('RETBA', 'T257'),
    fix('MOPIR', 'M871'),
    fix('LASPO', 'M871'),
    fix('ORVUS', 'M871'),
    fix('GODOX', 'M871'),
    { type: 1, id: 'LEPA', via: 'ADES', altitude: 27, latitude: 39.55, longitude: 2.74 },
  ],
};

describe('routeTextFromFms', () => {
  it('names each airway once, between the fixes where the route joins and leaves it', () => {
    expect(routeTextFromFms(plan)).toBe('NANDO T257 RETBA M871 GODOX');
  });

  it('starts on the airway when the file does not list the fix the SID handed over at', () => {
    // Little Navmap leaves the SID exit out of the rows: the first row is already on N10.
    const rows = [plan.waypoints[0]!, fix('INPAN', 'N10'), fix('CRISA', 'N10'), plan.waypoints[9]!];
    expect(routeTextFromFms({ ...plan, waypoints: rows })).toBe('INPAN N10 CRISA');
  });

  it('writes coordinate rows as the planner reads them', () => {
    const rows = [
      plan.waypoints[0]!,
      { ...fix('FIX01', 'DRCT', 40000, 28), latitude: 39, longitude: -38 },
      fix('RNGRS', 'DRCT'),
      plan.waypoints[9]!,
    ];
    expect(routeTextFromFms({ ...plan, waypoints: rows })).toBe('39/-38 RNGRS');
  });

  it('files a direct route when the file lists no fixes', () => {
    const rows = [plan.waypoints[0]!, plan.waypoints[9]!];
    expect(routeTextFromFms({ ...plan, waypoints: rows })).toBe('DCT');
  });
});

describe('draftFromFms', () => {
  it('fills both ends with their runways, the route and the cruise level from the rows', () => {
    const draft = draftFromFms(plan, (icao) => (icao === 'LEMD' ? 'Madrid Barajas' : undefined))!;
    expect(draft.departure).toEqual({
      icao: 'LEMD',
      name: 'Madrid Barajas',
      latitude: 40.47,
      longitude: -3.56,
      runway: '36L',
    });
    expect(draft.arrival).toEqual({
      icao: 'LEPA',
      name: undefined,
      latitude: 39.55,
      longitude: 2.74,
      runway: '24L',
    });
    expect(draft.routeText).toBe('NANDO T257 RETBA M871 GODOX');
    expect(draft.cruiseAltitudeFt).toBe(31000);
    expect(draft.filed).toEqual({
      sid: { name: 'NAND3N', transition: 'NANDO' },
      star: { name: 'GODO4P', transition: 'GODOX' },
    });
  });

  it('leaves the cruise level for the planner to suggest when the rows carry none', () => {
    const rows = plan.waypoints.map((wp) => ({ ...wp, altitude: 0 }));
    expect(
      draftFromFms({ ...plan, waypoints: rows }, () => undefined)!.cruiseAltitudeFt
    ).toBeNull();
  });

  it('carries the approach and its transition', () => {
    const withApproach: FMSFlightPlan = {
      ...plan,
      arrival: {
        icao: 'LEZL',
        runway: '27',
        star: 'HIJ4E',
        approach: 'I27-Z',
        approachTransition: 'RUVEN',
      },
    };
    expect(draftFromFms(withApproach, () => undefined)!.filed).toEqual({
      sid: { name: 'NAND3N', transition: 'NANDO' },
      star: { name: 'HIJ4E', transition: undefined },
      approach: { name: 'I27-Z', transition: 'RUVEN' },
    });
  });

  it('returns null without both airports', () => {
    const rows = plan.waypoints.filter((wp) => wp.via !== 'ADES');
    expect(draftFromFms({ ...plan, waypoints: rows }, () => undefined)).toBeNull();
  });
});
