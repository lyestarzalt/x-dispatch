/**
 * Nav data cache pipeline tests.
 * Verifies insert/count/getAll/clear operations for navaids, waypoints, and airways
 * against a real in-memory SQLite database via the test helper.
 */
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeTestDb, createTestDb, getTestDb } from '../../../../../tests/helpers/db';

// ---------------------------------------------------------------------------
// Mock Electron globals and logger — not available in the Vitest node environment.
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' },
}));

vi.mock('@/lib/utils/logger', () => {
  const noop = () => {};
  const channel = { info: noop, warn: noop, error: noop, debug: noop };
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      main: channel,
      data: channel,
      ipc: channel,
      security: channel,
      launcher: channel,
      tracker: channel,
      addon: channel,
    },
    getLogPath: () => '/tmp/test.log',
  };
});

// ---------------------------------------------------------------------------
// Mock @/lib/db so navCache uses the test DB instead of the Electron DB.
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema');
  return {
    ...schema,
    getDb: () => getTestDb(),
    saveDb: vi.fn(),
  };
});

// Import the modules under test AFTER vi.mock() has been registered.
const {
  insertNavaids,
  getAllNavaidsFromDb,
  getNavaidCount,
  clearNavaids,
  insertWaypoints,
  getAllWaypointsFromDb,
  getWaypointCount,
  clearWaypoints,
  insertAirways,
  getAllAirwaysFromDb,
  getAirwayCount,
  clearAirways,
  persistNavDatabase,
} = await import('./navCache');

const { parseNavaids } = await import('@/lib/parsers/nav/navaidParser');
const { parseWaypoints } = await import('@/lib/parsers/nav/waypointParser');
const { parseAirways } = await import('@/lib/parsers/nav/airwayParser');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURES_DIR = path.resolve(__dirname, '../../../../../tests/fixtures');

function readFixture(filename: string): string {
  return fs.readFileSync(path.join(FIXTURES_DIR, filename), 'utf-8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('navCache pipeline', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  // ---- Navaids ----

  describe('navaids', () => {
    it('inserts parsed navaids and returns the correct count', () => {
      const content = readFixture('earth_nav-sample.dat');
      const result = parseNavaids(content);
      expect(result.data.length).toBeGreaterThan(0);

      insertNavaids(result.data);
      expect(getNavaidCount()).toBe(result.data.length);
    });

    it('returns zero count when no navaids have been inserted', () => {
      expect(getNavaidCount()).toBe(0);
    });

    it('getAllNavaidsFromDb returns all inserted navaids', () => {
      const content = readFixture('earth_nav-sample.dat');
      const { data: parsed } = parseNavaids(content);
      insertNavaids(parsed);

      const all = getAllNavaidsFromDb();
      expect(all).toHaveLength(parsed.length);
    });

    it('getAllNavaidsFromDb returns empty array when table is empty', () => {
      expect(getAllNavaidsFromDb()).toEqual([]);
    });

    it('navaid coordinates survive the insert/query round-trip within float tolerance', () => {
      const content = readFixture('earth_nav-sample.dat');
      const { data: parsed } = parseNavaids(content);
      insertNavaids(parsed);

      const first = parsed[0];
      const all = getAllNavaidsFromDb();
      const found = all.find((n) => n.id === first.id);

      expect(found).toBeDefined();
      expect(found!.latitude).toBeCloseTo(first.latitude, 4);
      expect(found!.longitude).toBeCloseTo(first.longitude, 4);
    });

    it('clearNavaids removes all entries', () => {
      const content = readFixture('earth_nav-sample.dat');
      const { data: parsed } = parseNavaids(content);
      insertNavaids(parsed);
      expect(getNavaidCount()).toBeGreaterThan(0);

      clearNavaids();
      expect(getNavaidCount()).toBe(0);
      expect(getAllNavaidsFromDb()).toEqual([]);
    });

    it('clearNavaids is idempotent on an already-empty table', () => {
      clearNavaids();
      expect(getNavaidCount()).toBe(0);
    });
  });

  // ---- Waypoints ----

  describe('waypoints', () => {
    it('inserts parsed waypoints and returns the correct count', () => {
      const content = readFixture('earth_fix-sample.dat');
      const result = parseWaypoints(content);
      expect(result.data.length).toBeGreaterThan(0);

      insertWaypoints(result.data);
      expect(getWaypointCount()).toBe(result.data.length);
    });

    it('returns zero count when no waypoints have been inserted', () => {
      expect(getWaypointCount()).toBe(0);
    });

    it('getAllWaypointsFromDb returns all inserted waypoints', () => {
      const content = readFixture('earth_fix-sample.dat');
      const { data: parsed } = parseWaypoints(content);
      insertWaypoints(parsed);

      const all = getAllWaypointsFromDb();
      expect(all).toHaveLength(parsed.length);
    });

    it('getAllWaypointsFromDb returns empty array when table is empty', () => {
      expect(getAllWaypointsFromDb()).toEqual([]);
    });

    it('waypoint coordinates survive the insert/query round-trip within float tolerance', () => {
      const content = readFixture('earth_fix-sample.dat');
      const { data: parsed } = parseWaypoints(content);
      insertWaypoints(parsed);

      const first = parsed[0];
      const all = getAllWaypointsFromDb();
      const found = all.find((w) => w.id === first.id && w.region === first.region);

      expect(found).toBeDefined();
      expect(found!.latitude).toBeCloseTo(first.latitude, 4);
      expect(found!.longitude).toBeCloseTo(first.longitude, 4);
    });

    it('clearWaypoints removes all entries', () => {
      const content = readFixture('earth_fix-sample.dat');
      const { data: parsed } = parseWaypoints(content);
      insertWaypoints(parsed);
      expect(getWaypointCount()).toBeGreaterThan(0);

      clearWaypoints();
      expect(getWaypointCount()).toBe(0);
      expect(getAllWaypointsFromDb()).toEqual([]);
    });

    it('clearWaypoints is idempotent on an already-empty table', () => {
      clearWaypoints();
      expect(getWaypointCount()).toBe(0);
    });
  });

  // ---- Airways ----

  describe('airways', () => {
    it('inserts parsed airways and returns the correct count', () => {
      const content = readFixture('earth_awy-sample.dat');
      const result = parseAirways(content);
      expect(result.data.length).toBeGreaterThan(0);

      insertAirways(result.data);
      expect(getAirwayCount()).toBe(result.data.length);
    });

    it('returns zero count when no airways have been inserted', () => {
      expect(getAirwayCount()).toBe(0);
    });

    it('getAllAirwaysFromDb returns all inserted airways', () => {
      const content = readFixture('earth_awy-sample.dat');
      const { data: parsed } = parseAirways(content);
      insertAirways(parsed);

      const all = getAllAirwaysFromDb();
      expect(all).toHaveLength(parsed.length);
    });

    it('getAllAirwaysFromDb returns empty array when table is empty', () => {
      expect(getAllAirwaysFromDb()).toEqual([]);
    });

    it('airway name and fix data survive the insert/query round-trip', () => {
      const content = readFixture('earth_awy-sample.dat');
      const { data: parsed } = parseAirways(content);
      insertAirways(parsed);

      const first = parsed[0];
      const all = getAllAirwaysFromDb();
      const found = all.find(
        (a) => a.name === first.name && a.fromFix === first.fromFix && a.toFix === first.toFix
      );

      expect(found).toBeDefined();
      expect(found!.name).toBe(first.name);
      expect(found!.fromFix).toBe(first.fromFix);
      expect(found!.toFix).toBe(first.toFix);
    });

    it('clearAirways removes all entries', () => {
      const content = readFixture('earth_awy-sample.dat');
      const { data: parsed } = parseAirways(content);
      insertAirways(parsed);
      expect(getAirwayCount()).toBeGreaterThan(0);

      clearAirways();
      expect(getAirwayCount()).toBe(0);
      expect(getAllAirwaysFromDb()).toEqual([]);
    });

    it('clearAirways is idempotent on an already-empty table', () => {
      clearAirways();
      expect(getAirwayCount()).toBe(0);
    });
  });

  // ---- persistNavDatabase (saveDb no-op mock) ----

  it('persistNavDatabase does not throw', () => {
    expect(() => persistNavDatabase()).not.toThrow();
  });
});
