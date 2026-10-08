import { describe, expect, it } from 'vitest';
import type { EnrichedFlightPlan, EnrichedWaypoint } from '@/types/fms';
import { mergeStationData, toFmsPlan } from './stationData';

const wp = (over: Partial<EnrichedWaypoint>): EnrichedWaypoint => ({
  type: 11,
  id: 'FIX',
  via: 'DRCT',
  altitude: 0,
  latitude: 0,
  longitude: 0,
  found: true,
  ...over,
});

const plan = (waypoints: EnrichedWaypoint[]): EnrichedFlightPlan => ({
  version: 1100,
  departure: { icao: 'LFMC' },
  arrival: { icao: 'LFLL' },
  waypoints,
  resolution: { total: waypoints.length, found: waypoints.length, notFound: 0, cycleMatch: true },
});

describe('mergeStationData', () => {
  const simbrief = plan([
    wp({ id: 'LFMC', type: 1, via: 'ADEP', latitude: 43.38, longitude: 6.39 }),
    wp({ id: 'MTL', type: 3, latitude: 44.56, longitude: 4.78, altitude: 24000, stage: 'CRZ' }),
    wp({ id: 'GILON', latitude: 43.6, longitude: 6.2 }),
  ]);

  it('adds the station name, type and frequency without moving the waypoint', () => {
    const lookup = plan([
      wp({ id: 'LFMC', type: 1 }),
      wp({
        id: 'MTL',
        type: 3,
        latitude: 44.5601,
        longitude: 4.7799,
        name: 'MONTELIMAR',
        navaidType: 'VOR-DME',
        frequency: 113.65,
        region: 'LF',
      }),
      wp({ id: 'GILON', found: false }),
    ]);
    const merged = mergeStationData(simbrief, lookup);
    expect(merged.waypoints[1]).toMatchObject({
      latitude: 44.56,
      longitude: 4.78,
      altitude: 24000,
      stage: 'CRZ',
      name: 'MONTELIMAR',
      navaidType: 'VOR-DME',
      frequency: 113.65,
    });
  });

  it('never changes the found flag, which means trusted on a SimBrief plan', () => {
    const lookup = plan([
      wp({ id: 'LFMC' }),
      wp({ id: 'MTL', found: false }),
      wp({ id: 'GILON', found: false }),
    ]);
    const merged = mergeStationData(simbrief, lookup);
    expect(merged.waypoints.every((w) => w.found)).toBe(true);
    expect(merged).toBe(simbrief);
  });

  it('keeps a frequency the plan already carried', () => {
    const withFreq = plan([wp({ id: 'MTL', type: 3, frequency: 113.65 })]);
    const lookup = plan([wp({ id: 'MTL', type: 3, frequency: 999 })]);
    expect(mergeStationData(withFreq, lookup).waypoints[0]?.frequency).toBe(113.65);
  });

  it('ignores a lookup that does not line up with the plan', () => {
    expect(mergeStationData(simbrief, null)).toBe(simbrief);
    expect(mergeStationData(simbrief, plan([wp({ id: 'MTL' })]))).toBe(simbrief);
    const shifted = plan([wp({ id: 'X' }), wp({ id: 'Y', name: 'NOPE' }), wp({ id: 'Z' })]);
    expect(mergeStationData(simbrief, shifted)).toBe(simbrief);
  });
});

describe('toFmsPlan', () => {
  it('keeps only the fields the enrichment lookup reads', () => {
    const source = plan([wp({ id: 'MTL', type: 3, stage: 'CRZ', name: 'X', frequency: 1 })]);
    expect(toFmsPlan(source).waypoints[0]).toEqual({
      type: 3,
      id: 'MTL',
      via: 'DRCT',
      altitude: 0,
      latitude: 0,
      longitude: 0,
    });
  });
});
