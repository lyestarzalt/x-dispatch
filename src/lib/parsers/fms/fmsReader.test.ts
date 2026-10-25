import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FmsReader, HeaderedFormat, RowsOnlyFormat, parseFMSFile } from './fmsReader';

// Real files pilots sent in, one per writer. They differ in header order, in whether
// the transition lines name a published transition, in whether NUMENR is right, and
// the Zibo MCDU still writes the X-Plane 10 layout.
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/${name}.fms`, import.meta.url), 'utf8');

const FIXTURES = [
  { name: 'flycharts', departure: 'LEMD', arrival: 'LEPA', version: 1100 },
  { name: 'simbrief', departure: 'LEMD', arrival: 'LEZL', version: 1100 },
  { name: 'littlenavmap', departure: 'LEMD', arrival: 'LEZL', version: 1100 },
  { name: 'zibo-mcdu', departure: 'LFLS', arrival: 'LSGG', version: 3 },
];

describe.each(FIXTURES)('every writer: $name', ({ name, departure, arrival, version }) => {
  const result = parseFMSFile(fixture(name));

  it('reads the file', () => {
    expect(result.success).toBe(true);
    expect(result.data!.version).toBe(version);
  });

  it('names both airports and marks their rows', () => {
    const plan = result.data!;
    expect(plan.departure.icao).toBe(departure);
    expect(plan.arrival.icao).toBe(arrival);
    expect(plan.waypoints[0]).toMatchObject({ type: 1, id: departure, via: 'ADEP' });
    expect(plan.waypoints.at(-1)).toMatchObject({ type: 1, id: arrival, via: 'ADES' });
  });

  it('gives every row a position', () => {
    for (const wp of result.data!.waypoints) {
      expect(Number.isFinite(wp.latitude)).toBe(true);
      expect(Number.isFinite(wp.longitude)).toBe(true);
      expect(wp.via).not.toBe('');
    }
  });
});

describe('FmsReader.formatFor', () => {
  it('picks the headered layout from 1100 up and the rows-only layout below', () => {
    expect(FmsReader.formatFor(1100)).toBeInstanceOf(HeaderedFormat);
    expect(FmsReader.formatFor(1200)).toBeInstanceOf(HeaderedFormat);
    expect(FmsReader.formatFor(3)).toBeInstanceOf(RowsOnlyFormat);
  });
});

describe('headered files (1100 Version)', () => {
  it('reads SID and STAR lines written after NUMENR, and every row despite a wrong count', () => {
    const plan = parseFMSFile(fixture('flycharts')).data!;
    expect(plan.departure).toEqual({
      icao: 'LEMD',
      runway: '36L',
      sid: 'NAND3N',
      sidTransition: 'NANDO',
    });
    expect(plan.arrival).toEqual({
      icao: 'LEPA',
      runway: '24L',
      star: 'GODO4P',
      starTransition: 'GODOX',
    });
    expect(plan.waypoints.map((w) => w.id)).toEqual([
      'LEMD',
      'NANDO',
      'FENXE',
      'MABUX',
      'RETBA',
      'MOPIR',
      'LASPO',
      'ORVUS',
      'GODOX',
      'LEPA',
    ]);
  });

  it('keeps a SID and STAR filed without transitions', () => {
    const plan = parseFMSFile(fixture('simbrief')).data!;
    expect(plan.departure).toEqual({ icao: 'LEMD', runway: '36L', sid: 'VTB2X' });
    expect(plan.arrival).toEqual({ icao: 'LEZL', runway: '27', star: 'HIJ4E' });
    expect(plan.waypoints.map((w) => `${w.id}/${w.via}`)).toEqual([
      'LEMD/ADEP',
      'VTB/DRCT',
      'INPAN/N10',
      'CRISA/N10',
      'HIJ/N10',
      'LEZL/ADES',
    ]);
  });

  it('keeps the approach name when a transition line follows it', () => {
    const plan = parseFMSFile(fixture('littlenavmap')).data!;
    expect(plan.departure).toEqual({ icao: 'LEMD', runway: '14L', sid: 'VTB3V' });
    expect(plan.arrival).toEqual({
      icao: 'LEZL',
      runway: '27',
      star: 'HIJ4E',
      approach: 'I27-Z',
      approachTransition: 'RUVEN',
    });
    expect(plan.waypoints.map((w) => w.id)).toEqual(['LEMD', 'INPAN', 'CRISA', 'LEZL']);
  });

  it('keeps the procedure names when the transition lines come first', () => {
    const text = fixture('simbrief')
      .replace('SID VTB2X\n', 'SIDTRANS VTB\nSID VTB2X\n')
      .replace('STAR HIJ4E\n', 'STARTRANS HIJ\nSTAR HIJ4E\n');
    const plan = parseFMSFile(text).data!;
    expect(plan.departure.sid).toBe('VTB2X');
    expect(plan.departure.sidTransition).toBe('VTB');
    expect(plan.arrival.star).toBe('HIJ4E');
    expect(plan.arrival.starTransition).toBe('HIJ');
  });

  it('reads Windows line endings', () => {
    const plan = parseFMSFile(fixture('simbrief').replace(/\n/g, '\r\n')).data!;
    expect(plan.waypoints).toHaveLength(6);
  });
});

describe('rows-only files (3 version)', () => {
  it('reads the version whatever its case', () => {
    expect(parseFMSFile(fixture('zibo-mcdu')).data!.version).toBe(3);
  });

  it('reads the five-column rows as direct fixes between the airports', () => {
    const plan = parseFMSFile(fixture('zibo-mcdu')).data!;
    expect(plan.waypoints.map((w) => `${w.id} ${w.via}`)).toEqual([
      'LFLS ADEP',
      'BELUS DRCT',
      'INDIS DRCT',
      'LSGG ADES',
    ]);
    expect(plan.waypoints[1]).toMatchObject({ latitude: 45.675277778, longitude: 5.593888889 });
    expect(plan.waypoints.at(-1)).toMatchObject({
      latitude: 46.238333333,
      longitude: 6.109444444,
    });
  });

  it('takes a runway written as a fix for the arrival runway and drops the missed approach after it', () => {
    const plan = parseFMSFile(fixture('zibo-mcdu')).data!;
    expect(plan.arrival.runway).toBe('04');
    expect(plan.waypoints.some((w) => w.id === 'RW04' || w.id === 'SPR')).toBe(false);
  });

  it('takes a runway fix right after the departure for the departure runway', () => {
    const text = fixture('zibo-mcdu').replace('11 BELUS', '11 RW09 0 45.36 5.33\n11 BELUS');
    const plan = parseFMSFile(text).data!;
    expect(plan.departure.runway).toBe('09');
    expect(plan.waypoints.map((w) => w.id)).toEqual(['LFLS', 'BELUS', 'INDIS', 'LSGG']);
  });

  it('leaves a file with a single airport row as it is', () => {
    const plan = parseFMSFile(
      'I\n3 version\n1\n1\n1 LFLS 0 45.36 5.33\n11 BELUS 0 45.67 5.59\n'
    ).data!;
    expect(plan.departure.icao).toBe('');
    expect(plan.waypoints.map((w) => w.id)).toEqual(['LFLS', 'BELUS']);
  });
});

describe('rejected files', () => {
  it('rejects a file without the header', () => {
    expect(parseFMSFile('hello\n').success).toBe(false);
  });

  it('rejects a file without a version line', () => {
    const result = parseFMSFile('I\nnot a version\n');
    expect(result.success).toBe(false);
    expect(result.error).toContain('version');
  });
});
