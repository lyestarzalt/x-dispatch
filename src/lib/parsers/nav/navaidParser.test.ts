import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Navaid } from '@/types/navigation';
import type { ParseResult } from '../types';
import { parseNavaids } from './navaidParser';

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
    // The fixture contains well-formed data — all lines should parse cleanly.
    // Errors array is populated only for validation failures; skipped lines
    // (unknown row codes, short lines) do not produce errors.
    expect(result.errors).toHaveLength(0);
  });
});
