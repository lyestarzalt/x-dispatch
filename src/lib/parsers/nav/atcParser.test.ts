import { describe, expect, it } from 'vitest';
import { parseATCData } from './atcParser';

// Shaped like the Navigraph atc.dat blocks: a centre with a sector polygon,
// a TRACON with explicit airport links, and a tower.
const SAMPLE = `A
1000 ATCFILE

CONTROLLER
NAME ALGIERS
FACILITY_ID DAAA
ROLE ctr
FREQ 12045
FREQ 12380
AIRSPACE_POLYGON_BEGIN     0 60000
POINT 39.000000 4.666667
POINT 39.000000 8.000000
POINT 35.750000 8.250000
AIRSPACE_POLYGON_END

CONTROLLER
NAME POTOMAC
FACILITY_ID KDCA
ROLE tracon
CLASS B
TRANSITION_ALT 18000
ICAO KDCA
ICAO KIAD
FREQ 11895
AIRSPACE_POLYGON_BEGIN     0 10000
POINT 38.90 -77.10
POINT 38.90 -77.00
POINT 38.80 -77.00
AIRSPACE_POLYGON_END
AIRSPACE_POLYGON_BEGIN  1500 10000
POINT 39.10 -77.40
POINT 39.10 -76.80
POINT 38.60 -76.80
AIRSPACE_POLYGON_END

CONTROLLER
NAME NADZAB
FACILITY_ID AYNZ
ROLE twr
FREQ 12050
`;

describe('parseATCData', () => {
  it('parses TRACON facilities instead of skipping them', () => {
    const { data } = parseATCData(SAMPLE);
    const potomac = data.find((c) => c.name === 'POTOMAC');
    expect(potomac?.role).toBe('tracon');
    expect(data).toHaveLength(3);
  });

  it('keeps the explicit airport links of a facility', () => {
    const { data } = parseATCData(SAMPLE);
    expect(data.find((c) => c.name === 'POTOMAC')?.icaos).toEqual(['KDCA', 'KIAD']);
    expect(data.find((c) => c.name === 'NADZAB')?.icaos).toEqual([]);
  });

  it('keeps frequencies in MHz and the sector polygon with its band', () => {
    const { data } = parseATCData(SAMPLE);
    const algiers = data.find((c) => c.name === 'ALGIERS')!;
    expect(algiers.frequencies).toEqual([120.45, 123.8]);
    expect(algiers.airspaces).toHaveLength(1);
    expect(algiers.airspaces[0]!.minAlt).toBe(0);
    expect(algiers.airspaces[0]!.maxAlt).toBe(60000);
    expect(algiers.airspaces[0]!.polygon).toHaveLength(3);
    expect(algiers.airspaces[0]!.polygon[0]).toEqual([4.666667, 39]);
  });

  it('keeps every shelf of a multi-polygon facility, not just the last', () => {
    // 1158 facilities in the real file have several shelves (Potomac has 12+).
    const { data } = parseATCData(SAMPLE);
    const potomac = data.find((c) => c.name === 'POTOMAC')!;
    expect(potomac.airspaces.map((a) => [a.minAlt, a.maxAlt])).toEqual([
      [0, 10000],
      [1500, 10000],
    ]);
  });

  it('gives polygon-less facilities an empty list', () => {
    const { data } = parseATCData(SAMPLE);
    expect(data.find((c) => c.name === 'NADZAB')!.airspaces).toEqual([]);
  });
});
