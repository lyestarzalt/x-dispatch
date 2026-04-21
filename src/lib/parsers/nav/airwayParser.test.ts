import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { AirwaySegment } from '@/types/navigation';
import type { ParseResult } from '../types';
import { parseAirways } from './airwayParser';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/earth_awy-sample.dat');

let result: ParseResult<AirwaySegment[]>;

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  result = parseAirways(raw);
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
  it('parses at least one airway segment', () => {
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
  it('all segments have a non-empty name', () => {
    for (const segment of result.data) {
      expect(segment.name).toBeTruthy();
      expect(segment.name.length).toBeGreaterThan(0);
    }
  });

  it('all segments have a non-empty fromFix', () => {
    for (const segment of result.data) {
      expect(segment.fromFix).toBeTruthy();
      expect(segment.fromFix.length).toBeGreaterThan(0);
    }
  });

  it('all segments have a non-empty toFix', () => {
    for (const segment of result.data) {
      expect(segment.toFix).toBeTruthy();
      expect(segment.toFix.length).toBeGreaterThan(0);
    }
  });

  it('all segments have baseFl >= 0', () => {
    for (const segment of result.data) {
      expect(segment.baseFl).toBeGreaterThanOrEqual(0);
    }
  });

  it('all segments have topFl >= baseFl', () => {
    for (const segment of result.data) {
      expect(segment.topFl).toBeGreaterThanOrEqual(segment.baseFl);
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
