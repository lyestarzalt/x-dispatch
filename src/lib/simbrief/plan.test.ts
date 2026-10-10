import { describe, expect, it } from 'vitest';
import fixture from './__fixtures__/ofp-v2.json';
import { slimOfp } from './ofp';
import { enrichedPlanFromOfp, procedurePathsFromNavlog } from './plan';

const ofp = slimOfp(fixture);

describe('enrichedPlanFromOfp', () => {
  const plan = enrichedPlanFromOfp(ofp);

  it('brackets the fixes with the departure and arrival airports', () => {
    expect(plan.waypoints[0]).toMatchObject({ id: 'OTHH', via: 'ADEP', type: 1, stage: 'CLB' });
    expect(plan.waypoints[plan.waypoints.length - 1]).toMatchObject({
      id: 'KJFK',
      via: 'ADES',
      type: 1,
      stage: 'DSC',
    });
    // The destination fix SimBrief puts at the end of the navlog is not drawn twice.
    expect(plan.waypoints.filter((wp) => wp.id === 'KJFK')).toHaveLength(1);
    expect(plan.waypoints).toHaveLength(ofp.navlog.length + 1);
  });

  it('reads the AIRAC cycle from params, where SimBrief puts it', () => {
    expect(plan.cycle).toBe('2610');
  });

  it('carries the runways, the STAR and its transition', () => {
    expect(plan.departure).toEqual({
      icao: 'OTHH',
      runway: '34R',
      sid: undefined,
      sidTransition: undefined,
    });
    expect(plan.arrival).toEqual({
      icao: 'KJFK',
      runway: '31L',
      star: 'PARCH4',
      starTransition: 'ENE',
    });
  });

  it('spells direct legs the way the FMS format does', () => {
    const patom = plan.waypoints.find((wp) => wp.id === 'PATOM');
    expect(patom?.via).toBe('DRCT');
    const lubet = plan.waypoints.find((wp) => wp.id === 'LUBET');
    expect(lubet?.via).toBe('L934');
  });

  it('keeps oceanic track legs on their track designator', () => {
    const onTrack = plan.waypoints.filter((wp) => wp.via === 'NATJ').map((wp) => wp.id);
    expect(onTrack).toEqual(['53N020W', '5430N03000W', '55N040W', '5330N05000W', 'PELTU']);
  });

  it('maps fix types and keeps navaid frequencies', () => {
    const dub = plan.waypoints.find((wp) => wp.id === 'DUB');
    expect(dub).toMatchObject({ type: 3, frequency: 114.9 });
    const toc = plan.waypoints.find((wp) => wp.id === 'TOC');
    expect(toc?.type).toBe(28);
    const patom = plan.waypoints.find((wp) => wp.id === 'PATOM');
    expect(patom).toMatchObject({ type: 11, frequency: undefined });
  });

  it('builds the STAR as a procedure path so the map colours it like a built plan', () => {
    expect(plan.procedurePaths).toHaveLength(1);
    const star = plan.procedurePaths![0]!;
    expect(star.via).toBe('PARCH4');
    expect(star.kind).toBe('star');
    // ASPEN TOD PVD TRAIT PARCH CCC ROBER JFK KJFK
    expect(star.path).toHaveLength(9);
    const aspen = ofp.navlog.find((fix) => fix.ident === 'ASPEN')!;
    expect(star.path[0]).toEqual({
      latitude: parseFloat(aspen.pos_lat),
      longitude: parseFloat(aspen.pos_long),
    });
  });

  it('uses the first alternate', () => {
    expect(plan.alternate).toMatchObject({ icao: 'KPHL' });
    expect(plan.alternate?.latitude).toBeCloseTo(39.87, 1);
  });

  it('has no alternate when the plan lists none', () => {
    expect(enrichedPlanFromOfp({ ...ofp, alternate: [] }).alternate).toBeUndefined();
  });

  it('still produces a plan from an empty navlog', () => {
    const empty = enrichedPlanFromOfp({ ...ofp, navlog: [] });
    expect(empty.waypoints.map((wp) => wp.via)).toEqual(['ADEP', 'ADES']);
    expect(empty.procedurePaths).toEqual([]);
  });
});

describe('procedurePathsFromNavlog', () => {
  const fix = (ident: string, via: string, sidStar: '0' | '1', lat = 1, lon = 1) =>
    ({
      ident,
      via_airway: via,
      is_sid_star: sidStar,
      pos_lat: String(lat),
      pos_long: String(lon),
    }) as unknown as (typeof ofp.navlog)[number];

  it('names a SID and a STAR by the idents SimBrief reports', () => {
    const navlog = [
      fix('A', 'SID1A', '1', 1, 1),
      fix('B', 'SID1A', '1', 2, 2),
      fix('C', 'L1', '0'),
      fix('D', 'STAR2B', '1', 3, 3),
      fix('E', 'STAR2B', '1', 4, 4),
    ];
    expect(procedurePathsFromNavlog(navlog, 'SID1A', 'STAR2B').map((p) => [p.via, p.kind])).toEqual(
      [
        ['SID1A', 'sid'],
        ['STAR2B', 'star'],
      ]
    );
  });

  it('falls back to position in the navlog when the names do not match', () => {
    const navlog = [
      fix('A', 'DEP1', '1', 1, 1),
      fix('B', 'DEP1', '1', 2, 2),
      fix('C', 'L1', '0'),
      fix('D', 'ARR1', '1', 3, 3),
      fix('E', 'ARR1', '1', 4, 4),
    ];
    expect(procedurePathsFromNavlog(navlog, undefined, undefined).map((p) => p.kind)).toEqual([
      'sid',
      'star',
    ]);
  });

  it('drops a single-fix procedure, which has no line to colour', () => {
    const navlog = [fix('A', 'DEP1', '1'), fix('C', 'L1', '0')];
    expect(procedurePathsFromNavlog(navlog, 'DEP1', undefined)).toEqual([]);
  });
});
