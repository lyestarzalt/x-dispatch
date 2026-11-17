import { describe, expect, it } from 'vitest';
import { chartedWithLocalizer, markIlsOrLoc, parseFaaProcedureIndex } from './faaProcedureIndex';

// The FAA's IN_CIFP.txt as distributed: tab-separated, CRLF, a header row.
const FILE = [
  'Arpt_ICAO\tProcedure Type\tProcedure Ident',
  'KBOS\tSIAP\tI04R',
  'KBOS\tSIAP\tL04R',
  'KBOS\tSIAP\tI27',
  'KBOS\tSIAP\tL27',
  'KBOS\tSIAP\tR04L',
  'KBOS\tSID\tBLZZR6',
  'KACY\tSIAP\tI13-Z',
  'KACY\tSIAP\tL13-Z',
  'KABI\tSIAP\tI35R',
  'KABI\tSIAP\tL17R',
  '',
].join('\r\n');

describe('parseFaaProcedureIndex', () => {
  it('keeps the approaches per airport and nothing else', () => {
    const index = parseFaaProcedureIndex(FILE);
    expect([...index.get('KBOS')!].sort()).toEqual(['I04R', 'I27', 'L04R', 'L27', 'R04L']);
    expect(index.has('Arpt_ICAO')).toBe(false);
  });

  it('reads an empty or foreign file as no approaches', () => {
    expect(parseFaaProcedureIndex('').size).toBe(0);
    expect(parseFaaProcedureIndex('not,a,cifp\nindex').size).toBe(0);
  });
});

describe('chartedWithLocalizer', () => {
  const index = parseFaaProcedureIndex(FILE);

  // KBOS: ILS OR LOC RWY 4R and RWY 27.
  it('marks an ILS whose runway also has a LOC procedure', () => {
    expect(chartedWithLocalizer(index, 'KBOS', 'I04R')).toBe(true);
    expect(chartedWithLocalizer(index, 'kbos', 'I27')).toBe(true);
  });

  it('matches the variant letter, not just the runway', () => {
    expect(chartedWithLocalizer(index, 'KACY', 'I13-Z')).toBe(true);
    expect(chartedWithLocalizer(index, 'KACY', 'I13-Y')).toBe(false);
  });

  it('leaves an ILS without a LOC on its runway alone', () => {
    // KABI here: an ILS on 35R and a LOC on 17R, none on 35R.
    expect(chartedWithLocalizer(index, 'KABI', 'I35R')).toBe(false);
  });

  it('only concerns ILS approaches, at airports the file lists', () => {
    expect(chartedWithLocalizer(index, 'KBOS', 'R04L')).toBe(false);
    expect(chartedWithLocalizer(index, 'EGLL', 'I27L')).toBe(false);
  });
});

describe('markIlsOrLoc', () => {
  it('marks only the approaches the index charts as ILS OR LOC', () => {
    const approaches: { name: string; orLocalizer?: boolean }[] = [
      { name: 'I04R' },
      { name: 'R04L' },
      { name: 'I22L' },
    ];
    markIlsOrLoc(approaches, parseFaaProcedureIndex(FILE), 'KBOS');
    expect(approaches.map((a) => a.orLocalizer ?? false)).toEqual([true, false, false]);
  });
});
