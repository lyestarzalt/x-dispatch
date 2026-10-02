import { describe, expect, it } from 'vitest';
import type { AirportProcedures, Navaid, ProcedureWaypoint } from '@/types/navigation';
import {
  createProcedureCoordResolver,
  enrichProceduresWithCoordinates,
} from './procedureCoordResolver';

const baseWaypoint: ProcedureWaypoint = {
  fixId: 'AZR',
  fixRegion: 'LF',
  fixType: 'D',
  pathTerminator: 'AF',
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
};

const navaid = (id: string, region: string, latitude: number, longitude: number): Navaid => ({
  type: 'VOR',
  id,
  name: id,
  latitude,
  longitude,
  elevation: 0,
  frequency: 0,
  range: 0,
  magneticVariation: 0,
  region,
  country: 'FR',
});

describe('procedure coordinate resolver - recommended navaid / center fix', () => {
  it('resolves the recommended navaid position for an AF leg', () => {
    const resolver = createProcedureCoordResolver([], [navaid('AZR', 'LF', 43.5, 7.2)]);
    const procedures: AirportProcedures = {
      icao: 'LFMN',
      sids: [],
      stars: [],
      approaches: [
        {
          type: 'APPROACH',
          name: 'D22LB',
          runway: null,
          transition: null,
          waypoints: [{ ...baseWaypoint, recNavaid: 'AZR', recNavaidRegion: 'LF' }],
        },
      ],
    };

    const resolved = enrichProceduresWithCoordinates(procedures, resolver);
    const wp = resolved.approaches[0]?.waypoints[0];
    expect(wp?.recNavaidLatitude).toBe(43.5);
    expect(wp?.recNavaidLongitude).toBe(7.2);
  });

  it('resolves the center fix position for an RF leg', () => {
    const resolver = createProcedureCoordResolver([], [navaid('TTRF1', 'RJ', 35.5, 139.7)]);
    const procedures: AirportProcedures = {
      icao: 'RJTT',
      sids: [],
      stars: [],
      approaches: [
        {
          type: 'APPROACH',
          name: 'R23',
          runway: null,
          transition: null,
          waypoints: [
            { ...baseWaypoint, pathTerminator: 'RF', centerFix: 'TTRF1', centerFixRegion: 'RJ' },
          ],
        },
      ],
    };

    const resolved = enrichProceduresWithCoordinates(procedures, resolver);
    const wp = resolved.approaches[0]?.waypoints[0];
    expect(wp?.centerFixLatitude).toBe(35.5);
    expect(wp?.centerFixLongitude).toBe(139.7);
  });

  it('leaves the recommended-navaid and center-fix positions undefined when absent', () => {
    const resolver = createProcedureCoordResolver([], []);
    const procedures: AirportProcedures = {
      icao: 'ZZZZ',
      sids: [],
      stars: [],
      approaches: [
        {
          type: 'APPROACH',
          name: 'TEST',
          runway: null,
          transition: null,
          waypoints: [{ ...baseWaypoint, pathTerminator: 'TF', recNavaid: null, centerFix: null }],
        },
      ],
    };

    const resolved = enrichProceduresWithCoordinates(procedures, resolver);
    const wp = resolved.approaches[0]?.waypoints[0];
    expect(wp?.recNavaidLatitude).toBeUndefined();
    expect(wp?.centerFixLatitude).toBeUndefined();
  });
});
