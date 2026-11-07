import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Navaid } from '@/types/navigation';
import type { ParseResult } from '../types';
import { isIlsDme, parseNavaids } from './navaidParser';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/earth_nav-sample.dat');

let result: ParseResult<Navaid[]>;

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  result = parseNavaids(raw);
});

// ---------------------------------------------------------------------------
// ParseResult shape
// ---------------------------------------------------------------------------

describe('ParseResult shape', () => {
  it('has data, errors, and stats fields', () => {
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('stats');
    expect(result.stats).toHaveProperty('total');
    expect(result.stats).toHaveProperty('parsed');
    expect(result.stats).toHaveProperty('skipped');
  });

  it('data is an array', () => {
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('errors is an array', () => {
    expect(Array.isArray(result.errors)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Parsed count
// ---------------------------------------------------------------------------

describe('Parsed count', () => {
  it('parses at least one navaid', () => {
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('stats.parsed matches data.length', () => {
    expect(result.stats.parsed).toBe(result.data.length);
  });

  it('skips no line of the fixture', () => {
    expect(result.stats.skipped).toBe(0);
    expect(result.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Navaid types present
// ---------------------------------------------------------------------------

describe('Navaid types present', () => {
  it('contains at least one VOR-family navaid (VOR, VOR-DME, or VORTAC)', () => {
    const vorTypes = new Set(['VOR', 'VOR-DME', 'VORTAC']);
    const hasVor = result.data.some((n) => vorTypes.has(n.type));
    expect(hasVor).toBe(true);
  });

  it('contains at least one NDB', () => {
    const hasNdb = result.data.some((n) => n.type === 'NDB');
    expect(hasNdb).toBe(true);
  });

  it('contains at least one ILS', () => {
    const hasIls = result.data.some((n) => n.type === 'ILS');
    expect(hasIls).toBe(true);
  });

  it('contains at least one DME-family navaid (DME or TACAN)', () => {
    const dmeTypes = new Set(['DME', 'TACAN']);
    const hasDme = result.data.some((n) => dmeTypes.has(n.type));
    expect(hasDme).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Coordinate validity
// ---------------------------------------------------------------------------

describe('Coordinate validity', () => {
  it('all navaids have latitude in [-90, 90]', () => {
    for (const navaid of result.data) {
      expect(navaid.latitude).toBeGreaterThanOrEqual(-90);
      expect(navaid.latitude).toBeLessThanOrEqual(90);
    }
  });

  it('all navaids have longitude in [-180, 180]', () => {
    for (const navaid of result.data) {
      expect(navaid.longitude).toBeGreaterThanOrEqual(-180);
      expect(navaid.longitude).toBeLessThanOrEqual(180);
    }
  });
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

describe('Required fields', () => {
  it('all navaids have a non-empty id', () => {
    for (const navaid of result.data) {
      expect(navaid.id).toBeTruthy();
      expect(navaid.id.length).toBeGreaterThan(0);
    }
  });

  it('all navaids have a non-empty name', () => {
    for (const navaid of result.data) {
      expect(navaid.name).toBeTruthy();
      expect(navaid.name.length).toBeGreaterThan(0);
    }
  });

  it('all navaids have a valid NavaidType', () => {
    const validTypes = new Set([
      'VOR',
      'VORTAC',
      'VOR-DME',
      'NDB',
      'DME',
      'TACAN',
      'ILS',
      'LOC',
      'GS',
      'OM',
      'MM',
      'IM',
      'FPAP',
      'GLS',
      'LTP',
      'FTP',
    ]);
    for (const navaid of result.data) {
      expect(validTypes.has(navaid.type)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Error count
// ---------------------------------------------------------------------------

describe('Parse errors', () => {
  it('has zero parse errors', () => {
    // Rows with codes the parser does not handle are passed over, not skipped.
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Paired DME rows
// ---------------------------------------------------------------------------

describe('paired DME rows (row code 12)', () => {
  // Row 12 is the DME component of a VOR/VORTAC/ILS — charts never draw it as
  // its own symbol, so it is not stored. Row 13 (standalone DME / NDB-DME) is.
  const content = [
    'I',
    '1200 Version - data cycle 2610.',
    '',
    ' 3  62.951033333 -155.611380556     1000    11350   130     14.000  MCG ENRT PA MC GRATH VORTAC',
    '12  62.951033333 -155.611380556     1000    11350   130      0.000  MCG ENRT PA MC GRATH VORTAC DME',
    '13  61.100000000 -150.000000000      100    11000    40      0.000  ZZD ENRT PA SOMEWHERE DME',
    '13  62.946362785 -155.607390404      300    10950    18      0.000  IMCG PAMC PA MCGRATH DME-ILS',
    '99',
  ].join('\n');

  it('drops the paired DME component, keeps the standalone DME', () => {
    const { data } = parseNavaids(content);
    const dmes = data.filter((n) => n.type === 'DME');
    expect(dmes.map((n) => n.id)).toEqual(['ZZD', 'IMCG']);
    expect(data.find((n) => n.type === 'VORTAC')?.id).toBe('MCG');
  });

  it('flags an ILS DME so the map does not draw it as a navaid', () => {
    const { data } = parseNavaids(content);
    expect(isIlsDme(data.find((n) => n.id === 'IMCG')!)).toBe(true);
    expect(isIlsDme(data.find((n) => n.id === 'ZZD')!)).toBe(false);
  });
});

describe('ILS localizer course (row codes 4 and 5)', () => {
  // XP1150+ packs magnetic course * 360 + true bearing into the bearing field.
  const content = [
    'I',
    '1200 Version - data cycle 2610',
    ' 4  42.382213889  -70.996719444       10    11030    18  12619.675 IBOS KBOS K6 04R ILS-cat-III',
    // Course 002°M with a true bearing of 359.0°: 2 * 360 + 359 = 1079.
    ' 4  60.000000000   10.000000000       10    10950    18   1079.000 IWRP ENWR EN 02 ILS-cat-I',
    '99',
  ].join('\n');

  it('splits the field into true bearing, magnetic course and their difference', () => {
    const { data } = parseNavaids(content);
    const ibos = data.find((n) => n.id === 'IBOS')!;
    expect(ibos.bearing).toBeCloseTo(19.675, 3);
    expect(ibos.course).toBe(35);
    // Boston: about 15° west, so negative.
    expect(ibos.magneticVariation).toBeCloseTo(-15.325, 3);
  });

  it('keeps the variation small across the 360 wrap', () => {
    const { data } = parseNavaids(content);
    const iwrp = data.find((n) => n.id === 'IWRP')!;
    expect(iwrp.bearing).toBeCloseTo(359, 3);
    expect(iwrp.course).toBe(2);
    expect(iwrp.magneticVariation).toBeCloseTo(-3, 3);
  });
});
