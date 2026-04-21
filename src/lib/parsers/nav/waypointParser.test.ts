import { readFileSync } from 'fs';
import { resolve } from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Waypoint } from '@/types/navigation';
import type { ParseResult } from '../types';
import { parseWaypoints } from './waypointParser';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

const FIXTURE_PATH = resolve(__dirname, '../../../../tests/fixtures/earth_fix-sample.dat');

let result: ParseResult<Waypoint[]>;

beforeAll(() => {
  const raw = readFileSync(FIXTURE_PATH, 'utf-8');
  result = parseWaypoints(raw);
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
  it('parses at least one waypoint', () => {
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('stats.parsed matches data.length', () => {
    expect(result.stats.parsed).toBe(result.data.length);
  });
});

// ---------------------------------------------------------------------------
// Coordinate validity
// ---------------------------------------------------------------------------

describe('Coordinate validity', () => {
  it('all waypoints have latitude in [-90, 90]', () => {
    for (const waypoint of result.data) {
      expect(waypoint.latitude).toBeGreaterThanOrEqual(-90);
      expect(waypoint.latitude).toBeLessThanOrEqual(90);
    }
  });

  it('all waypoints have longitude in [-180, 180]', () => {
    for (const waypoint of result.data) {
      expect(waypoint.longitude).toBeGreaterThanOrEqual(-180);
      expect(waypoint.longitude).toBeLessThanOrEqual(180);
    }
  });
});

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

describe('Required fields', () => {
  it('all waypoints have a non-empty id', () => {
    for (const waypoint of result.data) {
      expect(waypoint.id).toBeTruthy();
      expect(waypoint.id.length).toBeGreaterThan(0);
    }
  });

  it('all waypoints have a defined region', () => {
    for (const waypoint of result.data) {
      expect(waypoint.region).toBeDefined();
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
