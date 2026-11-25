import { describe, expect, it } from 'vitest';
import type { Navaid, ResolvedProcedureWaypoint } from '@/types/navigation';
import { procedureNavaids } from './procedureNavaids';

const leg = (over: Partial<ResolvedProcedureWaypoint>): ResolvedProcedureWaypoint =>
  ({
    fixId: 'FIX',
    fixRegion: 'K6',
    fixType: 'P',
    pathTerminator: 'TF',
    recNavaid: null,
    recNavaidRegion: null,
    ...over,
  }) as ResolvedProcedureWaypoint;

const navaid = (id: string, type: Navaid['type'], region = 'K6'): Navaid =>
  ({
    id,
    type,
    // As the database returns them: the ICAO region is in `country`.
    region: 'ENRT',
    country: region,
    name: id,
    latitude: 41,
    longitude: -70,
    frequency: 11400,
  }) as Navaid;

// GitHub #430, KMVY VOR RWY 06 as coded: every leg, the missed approach to CLAMY included, is
// measured from the MVY VOR (section D), and the missed approach flies over it. The ACK radial
// that also defines CLAMY is on the chart only, so ACK is not part of the coded procedure.
const rec = { recNavaid: 'MVY', recNavaidRegion: 'K6' };
const vor06 = [
  leg({ fixId: 'WERID', pathTerminator: 'IF', ...rec }),
  leg({ fixId: 'BEDOW', pathTerminator: 'CF', ...rec }),
  leg({ fixId: 'RW06', pathTerminator: 'CF', ...rec }),
  leg({ fixId: 'MVY', fixType: 'D', pathTerminator: 'CF', ...rec }),
  leg({ fixId: 'CLAMY', fixType: 'E', pathTerminator: 'CF', ...rec }),
  leg({ fixId: 'CLAMY', fixType: 'E', pathTerminator: 'HM' }),
];
const nearby = [
  navaid('MVY', 'VOR-DME'),
  navaid('ACK', 'VOR-DME'),
  navaid('TAN', 'NDB'),
  navaid('ACK', 'NDB', 'EG'),
];

describe('procedureNavaids', () => {
  it('returns the navaids the legs fly over or are measured from, each once', () => {
    expect(procedureNavaids(vor06, nearby).map((n) => `${n.id}/${n.country}`)).toEqual(['MVY/K6']);
  });

  it('keeps a beacon and a DME that share an ident (PADU DUT)', () => {
    const legs = [leg({ fixId: 'DUT', fixRegion: 'PA', fixType: 'D', pathTerminator: 'IF' })];
    const found = procedureNavaids(legs, [navaid('DUT', 'NDB', 'PA'), navaid('DUT', 'DME', 'PA')]);
    expect(found.map((n) => n.type)).toEqual(['NDB', 'DME']);
  });

  it('does not take a plain waypoint for a navaid with the same name', () => {
    const legs = [leg({ fixId: 'TAN', fixType: 'P' })];
    expect(procedureNavaids(legs, nearby)).toEqual([]);
  });

  it('is empty without legs or without navaids', () => {
    expect(procedureNavaids([], nearby)).toEqual([]);
    expect(procedureNavaids(vor06, [])).toEqual([]);
  });
});
