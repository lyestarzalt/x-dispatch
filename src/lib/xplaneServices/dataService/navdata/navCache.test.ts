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
  checkNavCacheValidity,
  updateNavFileMeta,
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

// ---------------------------------------------------------------------------
// Nav cache invalidation tests
// ---------------------------------------------------------------------------

// Import the schema table for direct DB seeding
const { navFileMeta: navFileMetaTable } = await import('@/lib/db/schema');

/**
 * Seed a nav_file_meta row directly via Drizzle, bypassing fs.statSync.
 * Using a helper outside describe so it can reference getTestDb at call time.
 */
function seedNavMeta(opts: {
  filePath: string;
  mtime: number;
  dataType: 'navaids' | 'waypoints' | 'airways' | 'airspaces';
  sourceType: 'xplane-default' | 'navigraph' | 'unknown';
}) {
  const db = getTestDb();
  db.insert(navFileMetaTable)
    .values({
      path: opts.filePath,
      mtime: opts.mtime,
      recordCount: 0,
      dataType: opts.dataType,
      sourceType: opts.sourceType,
    })
    .run();
}

describe('checkNavCacheValidity cache invalidation', () => {
  // Use a real fixture file so getFileMtime can stat it successfully.
  // The fixture path contains neither 'Custom Data' nor 'Resources/default data',
  // so detectSourceType returns 'unknown' — both cached and current will be 'unknown'.
  const FIXTURE_NAV = path.resolve(FIXTURES_DIR, 'earth_nav-sample.dat');

  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  it('indicates reload needed when no cached entry exists', () => {
    // Empty database — no nav_file_meta rows
    const result = checkNavCacheValidity(FIXTURE_NAV, 'navaids');

    expect(result.needsReload).toBe(true);
    expect(result.reason).toMatch(/no cached/i);
  });

  it('indicates no reload needed when mtime matches and source type matches', () => {
    // Read the real mtime of the fixture file
    const actualMtime = Math.floor(fs.statSync(FIXTURE_NAV).mtimeMs);

    // Seed with the exact real mtime
    seedNavMeta({
      filePath: FIXTURE_NAV,
      mtime: actualMtime,
      dataType: 'navaids',
      sourceType: 'unknown',
    });

    const result = checkNavCacheValidity(FIXTURE_NAV, 'navaids');

    expect(result.needsReload).toBe(false);
  });

  it('indicates reload needed when mtime changes', () => {
    // Seed with an outdated mtime (1 ms before the real mtime)
    const actualMtime = Math.floor(fs.statSync(FIXTURE_NAV).mtimeMs);
    const staleMtime = actualMtime - 1;

    seedNavMeta({
      filePath: FIXTURE_NAV,
      mtime: staleMtime,
      dataType: 'navaids',
      sourceType: 'unknown',
    });

    const result = checkNavCacheValidity(FIXTURE_NAV, 'navaids');

    expect(result.needsReload).toBe(true);
    expect(result.reason).toMatch(/modified/i);
  });

  it('indicates reload needed when source type changes from xplane-default to navigraph', () => {
    const xplanePath = '/xplane/Resources/default data/earth_nav.dat';
    const navigraphPath = '/xplane/Custom Data/earth_nav.dat';

    // Seed cache with the X-Plane default source type
    seedNavMeta({
      filePath: xplanePath,
      mtime: 999999,
      dataType: 'navaids',
      sourceType: 'xplane-default',
    });

    // Check with the Navigraph path (source type check fires before file I/O)
    const result = checkNavCacheValidity(navigraphPath, 'navaids');

    expect(result.needsReload).toBe(true);
    expect(result.reason).toMatch(/source changed/i);
  });

  it('indicates reload needed when source type changes from navigraph to xplane-default', () => {
    const navigraphPath = '/xplane/Custom Data/earth_nav.dat';
    const xplanePath = '/xplane/Resources/default data/earth_nav.dat';

    // Seed cache with the Navigraph source type
    seedNavMeta({
      filePath: navigraphPath,
      mtime: 888888,
      dataType: 'navaids',
      sourceType: 'navigraph',
    });

    // Check with the X-Plane default path
    const result = checkNavCacheValidity(xplanePath, 'navaids');

    expect(result.needsReload).toBe(true);
    expect(result.reason).toMatch(/source changed/i);
  });
});
