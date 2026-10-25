import { describe, expect, it } from 'vitest';
import { formatApproachName } from './approachName';

describe('formatApproachName', () => {
  it('names the runway form by type, variant and runway', () => {
    expect(formatApproachName('I04LZ', 'I')).toBe('ILS Z RWY 04L');
    expect(formatApproachName('I04R', 'I')).toBe('ILS RWY 04R');
    expect(formatApproachName('R22LY', 'R')).toBe('RNAV (GPS) Y RWY 22L');
    expect(formatApproachName('J11', 'J')).toBe('GLS RWY 11');
    expect(formatApproachName('L25', 'L')).toBe('LOC RWY 25');
    expect(formatApproachName('D22L', 'D')).toBe('VOR/DME RWY 22L');
  });

  it('reads a hyphenated variant on a runway without a side letter', () => {
    expect(formatApproachName('R29-T', 'R')).toBe('RNAV (GPS) T RWY 29');
    expect(formatApproachName('I36-1', 'I')).toBe('ILS 1 RWY 36');
  });

  it('keeps a true-heading runway designator and a numeric variant', () => {
    expect(formatApproachName('R15T', 'R')).toBe('RNAV (GPS) RWY 15T');
    expect(formatApproachName('I08TX', 'I')).toBe('ILS X RWY 08T');
    expect(formatApproachName('D29R1', 'D')).toBe('VOR/DME 1 RWY 29R');
  });

  it('trusts the record route type over the identifier letter', () => {
    expect(formatApproachName('L18', 'X')).toBe('LDA RWY 18');
    expect(formatApproachName('V27', 'D')).toBe('VOR/DME RWY 27');
    expect(formatApproachName('L07', 'B')).toBe('LOC BC RWY 07');
    expect(formatApproachName('N12', 'Q')).toBe('NDB/DME RWY 12');
  });

  it('falls back to the identifier letter without a route type', () => {
    expect(formatApproachName('H04RZ')).toBe('RNAV (RNP) Z RWY 04R');
    expect(formatApproachName('X19')).toBe('LDA RWY 19');
    expect(formatApproachName('T11RZ')).toBe('TACAN Z RWY 11R');
  });

  it('names circling approaches with a dash and their letter', () => {
    expect(formatApproachName('VORA', 'V')).toBe('VOR-A');
    expect(formatApproachName('RNVB', 'R')).toBe('RNAV (GPS)-B');
    expect(formatApproachName('NDBA', 'N')).toBe('NDB-A');
    expect(formatApproachName('VDMA', 'D')).toBe('VOR/DME-A');
    expect(formatApproachName('LDMB', 'L')).toBe('LOC/DME-B');
    expect(formatApproachName('GPSC', 'P')).toBe('GPS-C');
    expect(formatApproachName('LBCB', 'B')).toBe('LOC BC-B');
    expect(formatApproachName('NDB1', 'N')).toBe('NDB-1');
  });

  it('names the C-prefixed circling codes from the record route type', () => {
    expect(formatApproachName('CNDB', 'N')).toBe('NDB');
    expect(formatApproachName('CVDM', 'D')).toBe('VOR/DME');
    expect(formatApproachName('CVOR', 'V')).toBe('VOR');
    expect(formatApproachName('CNDB')).toBe('CNDB');
  });

  it('returns an unknown identifier unchanged', () => {
    expect(formatApproachName('NBAT', 'N')).toBe('NBAT');
    expect(formatApproachName('')).toBe('');
    expect(formatApproachName('ZZ')).toBe('ZZ');
  });
});
