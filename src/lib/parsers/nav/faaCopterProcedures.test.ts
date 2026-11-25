import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { parseCIFP } from './cifpParser';
import {
  faaCopterFromJson,
  faaCopterToJson,
  mergeAirportProcedures,
  parseFaaCopterProcedures,
  resolveFaaCopterProcedures,
} from './faaCopterProcedures';

// Real records of the FAA's FAACIFP18, cycle 2611: the West 30th Street heliport (KJRA, GitHub
// #432), LaGuardia's COPTER RNAV (GPS) 250 with the fixes both use, and three legs of
// LaGuardia's ILS 04, which is not a helicopter procedure.
const text = fs.readFileSync(
  path.resolve(__dirname, '../../../../tests/fixtures/faacifp-copter-sample.txt'),
  'latin1'
);
const data = parseFaaCopterProcedures(text);

describe('parseFaaCopterProcedures', () => {
  it('reads the cycle from the header', () => {
    expect(data.cycle).toBe('2611');
  });

  it('keeps helicopter procedures only', () => {
    expect([...data.airports.keys()].sort()).toEqual(['KJRA', 'KLGA']);
    const lga = parseCIFP(data.airports.get('KLGA')!.lines.join('\n'), 'KLGA');
    expect([...new Set(lga.approaches.map((a) => a.name))]).toEqual(['R250']);
  });

  it('hands the heliport departure to the procedure parser: HUDSN ONE to YOMAN', () => {
    const jra = parseCIFP(data.airports.get('KJRA')!.lines.join('\n'), 'KJRA');
    expect(jra.sids).toHaveLength(1);
    const sid = jra.sids[0]!;
    expect(sid).toMatchObject({ name: 'HUDSN1', transition: 'YOMAN' });
    expect(sid.waypoints.map((w) => w.fixId)).toEqual([
      'HUDSN',
      'RINNG',
      'CHNZO',
      'JOTRE',
      'YOMAN',
    ]);
    expect(sid.waypoints[1]!.altitude).toMatchObject({ descriptor: '+', altitude1: 2000 });
  });

  it('hands the heliport approach over with its legs, courses and the helicopter mark', () => {
    const jra = parseCIFP(data.airports.get('KJRA')!.lines.join('\n'), 'KJRA');
    expect(jra.approaches.map((a) => a.transition).sort()).toEqual(['FEMDU', 'WUDGO']);
    const viaFemdu = jra.approaches.find((a) => a.transition === 'FEMDU')!;
    expect(viaFemdu).toMatchObject({ name: 'R210', approachType: 'R', helicopter: true });
    expect(viaFemdu.waypoints.map((w) => `${w.pathTerminator} ${w.fixId}`)).toEqual([
      'IF FEMDU',
      'TF JEDIL',
      'TF ERORE',
      'TF ZABKI',
      'TF JORBA',
      'CA ',
      'DF JEDIL',
      'HM JEDIL',
    ]);
    const hold = viaFemdu.waypoints.at(-1)!;
    expect(hold).toMatchObject({ course: 193.1, distance: 4, turnDirection: 'R', speed: 90 });
    expect(viaFemdu.waypoints[5]).toMatchObject({ pathTerminator: 'CA', course: 210.1 });
  });

  it('carries the position of every fix the procedures use', () => {
    const fixes = new Map(data.airports.get('KJRA')!.fixes.map((f) => [f.id, f]));
    // HUDSN and RINNG are the two X-Plane's stock data lacks. N40°47'27.73" W073°59'07.94".
    expect(fixes.get('HUDSN')!.latitude).toBeCloseTo(40.791036, 5);
    expect(fixes.get('HUDSN')!.longitude).toBeCloseTo(-73.985539, 5);
    expect(fixes.get('HUDSN')!.region).toBe('K6');
    expect([...fixes.keys()].sort()).toEqual([
      'CHNZO',
      'ERORE',
      'FEMDU',
      'HUDSN',
      'JEDIL',
      'JORBA',
      'JOTRE',
      'RINNG',
      'WUDGO',
      'YOMAN',
      'ZABKI',
    ]);
  });

  it('lists every named fix of the file, enroute and terminal, for the planner to fall back on', () => {
    const byId = new Map(data.fixes.map((f) => [f[0], f]));
    // HUDSN is an enroute fix, ZABKI a terminal waypoint of the heliport.
    expect(byId.get('HUDSN')).toEqual(['HUDSN', 40.791036, -73.985539]);
    expect(byId.has('ZABKI')).toBe(true);
    expect(byId.has('NEUMN')).toBe(true);
  });

  it('survives the trip through the download cache', () => {
    const back = faaCopterFromJson(JSON.parse(JSON.stringify(faaCopterToJson(data))));
    expect(back?.cycle).toBe('2611');
    expect(back?.airports.get('KJRA')).toEqual(data.airports.get('KJRA'));
    expect(back?.fixes).toEqual(data.fixes);
    // A cache written before the fix list was kept is not one: it is downloaded again.
    const old = JSON.parse(JSON.stringify(faaCopterToJson(data))) as Record<string, unknown>;
    delete old.fixes;
    expect(faaCopterFromJson(old)).toBeNull();
    expect(faaCopterFromJson({ cycle: 'x' })).toBeNull();
    expect(faaCopterFromJson(null)).toBeNull();
  });
});

describe('resolveFaaCopterProcedures', () => {
  const nothing = () => null;

  it('places every fix from the FAA file, so HUDSN and RINNG need not be in the database', () => {
    const jra = resolveFaaCopterProcedures('KJRA', data.airports.get('KJRA')!, nothing);
    const sid = jra.sids[0]!;
    expect(sid.waypoints.every((w) => w.resolved)).toBe(true);
    expect(sid.waypoints[0]).toMatchObject({ fixId: 'HUDSN' });
    expect(sid.waypoints[0]!.latitude).toBeCloseTo(40.791036, 5);
    expect(sid.waypoints[0]!.longitude).toBeCloseTo(-73.985539, 5);
  });

  it('marks every procedure helicopter and FAA-only, the heliport departure included', () => {
    const jra = resolveFaaCopterProcedures('KJRA', data.airports.get('KJRA')!, nothing);
    for (const p of [...jra.sids, ...jra.approaches]) {
      expect(p).toMatchObject({ helicopter: true, faaOnly: true });
    }
  });

  it('asks the database only for what the FAA file does not place (a runway)', () => {
    const asked: string[] = [];
    resolveFaaCopterProcedures('KLGA', data.airports.get('KLGA')!, (id) => {
      asked.push(id);
      return null;
    });
    // Legs with no fix of their own (climb to an altitude) ask with an empty name.
    expect(asked.filter(Boolean)).toEqual([]);
  });
});

describe('mergeAirportProcedures', () => {
  const copter = resolveFaaCopterProcedures('KLGA', data.airports.get('KLGA')!, () => null);

  it('is the FAA procedures alone at a heliport X-Plane has nothing for', () => {
    expect(mergeAirportProcedures(null, copter)).toBe(copter);
  });

  it("adds them after the airport's own and never doubles one X-Plane already has", () => {
    const own = { icao: 'KLGA', sids: [], stars: [], approaches: [copter.approaches[0]!] };
    const merged = mergeAirportProcedures(own, copter);
    expect(merged.approaches).toHaveLength(copter.approaches.length);
    expect(merged.approaches[0]).toBe(own.approaches[0]);
  });
});
