import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Airspace } from '@/types/navigation';
import type { ParseResult } from '../types';
import { parseAirspaces } from './airspaceParser';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/airspace-sample.txt');

let result: ParseResult<Airspace[]>;

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  result = parseAirspaces(raw);
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
  it('parses at least one airspace', () => {
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('stats.parsed matches data.length', () => {
    expect(result.stats.parsed).toBe(result.data.length);
  });
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

describe('Required fields', () => {
  it('all airspaces have a non-empty name', () => {
    for (const airspace of result.data) {
      expect(airspace.name).toBeTruthy();
      expect(airspace.name.length).toBeGreaterThan(0);
    }
  });

  it('all airspaces have a defined class', () => {
    for (const airspace of result.data) {
      expect(airspace.class).toBeDefined();
    }
  });

  it('all airspaces have at least one coordinate', () => {
    for (const airspace of result.data) {
      expect(airspace.coordinates.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Error count
// ---------------------------------------------------------------------------

describe('Parse errors', () => {
  it('has zero parse errors', () => {
    expect(result.errors).toHaveLength(0);
  });
});
