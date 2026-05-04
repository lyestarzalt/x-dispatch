/**
 * Airport cache pipeline tests.
 * Verifies insertAirports, getAllAirportsFromDb, getAirportCount, and clearAirports
 * against a real in-memory SQLite database via the test helper.
 */
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeTestDb, createTestDb, getTestDb } from '../../../../../tests/helpers/db';
import type { ParsedAirportEntry } from '../types';

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
// Mock @/lib/db so airportCache uses the test DB instead of the Electron DB.
// The schema tables (airports, airportsCustom, aptFileMeta) are re-exported
// from the real schema module — we only replace getDb / saveDb.
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema');
  return {
    ...schema,
    getDb: () => getTestDb(),
    saveDb: vi.fn(),
  };
});

// Import the module under test AFTER vi.mock() has been registered.
const {
  insertAirports,
  insertCustomAirports,
  getAllAirportsFromDb,
  getAirportCount,
  clearAirports,
  clearCustomAirports,
  persistDatabase,
  detectAptFileChanges,
  updateStoredFileMeta,
} = await import('./airportCache');

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURE_PATH = path.resolve(__dirname, '../../../../../tests/fixtures/apt-sample.dat');

/**
 * Build a minimal ParsedAirportEntry directly — avoids async scanAptFile I/O
 * for fast unit tests while still exercising the full DB round-trip.
 */
function makeEntry(overrides: Partial<ParsedAirportEntry> & { icao: string }): ParsedAirportEntry {
  return {
    icao: overrides.icao,
    name: overrides.name ?? `${overrides.icao} Airport`,
    lat: overrides.lat ?? 0,
    lon: overrides.lon ?? 0,
    type: overrides.type ?? 'land',
    elevation: overrides.elevation,
    runwayCount: overrides.runwayCount,
    primarySurfaceType: overrides.primarySurfaceType,
    data: overrides.data ?? '',
    sourceFile: overrides.sourceFile ?? FIXTURE_PATH,
    city: overrides.city,
    country: overrides.country,
    iataCode: overrides.iataCode,
    faaCode: overrides.faaCode,
    regionCode: overrides.regionCode,
    state: overrides.state,
    transitionAlt: overrides.transitionAlt,
    transitionLevel: overrides.transitionLevel,
    towerServiceType: overrides.towerServiceType,
    driveOnLeft: overrides.driveOnLeft,
    guiLabel: overrides.guiLabel,
  };
}

/** Five representative entries mirroring the airports in apt-sample.dat */
const SAMPLE_ENTRIES: ParsedAirportEntry[] = [
  makeEntry({
    icao: 'KJFK',
    name: 'John F Kennedy Intl',
    lat: 40.639925,
    lon: -73.778694,
    type: 'land',
    elevation: 13,
    runwayCount: 4,
    primarySurfaceType: 2,
    country: 'USA United States',
    iataCode: 'JFK',
    faaCode: 'JFK',
    regionCode: 'K6',
    state: 'New York',
    transitionAlt: 18000,
    towerServiceType: 'atc',
    guiLabel: '2D',
  }),
  makeEntry({
    icao: 'EGLL',
    name: 'London Heathrow',
    lat: 51.4775,
    lon: -0.4614,
    type: 'land',
    elevation: 83,
    runwayCount: 2,
    primarySurfaceType: 2,
    country: 'GBR United Kingdom',
    iataCode: 'LHR',
  }),
  makeEntry({
    icao: 'LFPG',
    name: 'Paris - Charles De Gaulle',
    lat: 49.0097,
    lon: 2.5478,
    type: 'land',
    elevation: 392,
    runwayCount: 4,
    primarySurfaceType: 2,
    country: 'FRA France',
    iataCode: 'CDG',
  }),
  makeEntry({
    icao: 'KLAX',
    name: 'Los Angeles Intl',
    lat: 33.9425,
    lon: -118.408,
    type: 'land',
    elevation: 125,
    runwayCount: 4,
    primarySurfaceType: 2,
    country: 'USA United States',
    iataCode: 'LAX',
  }),
  makeEntry({
    icao: 'OTHH',
    name: 'Doha Hamad Intl',
    lat: 25.2731,
    lon: 51.6082,
    type: 'land',
    elevation: 13,
    runwayCount: 2,
    primarySurfaceType: 2,
    country: 'QAT Qatar',
    iataCode: 'DOH',
  }),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('airportCache pipeline', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  // ---- insertAirports + getAirportCount ----

  it('inserts airports and returns correct count', () => {
    insertAirports(SAMPLE_ENTRIES);
    expect(getAirportCount()).toBe(SAMPLE_ENTRIES.length);
  });

  it('returns zero count when no airports have been inserted', () => {
    expect(getAirportCount()).toBe(0);
  });

  // ---- getAllAirportsFromDb ----

  it('getAllAirportsFromDb returns all inserted airports', () => {
    insertAirports(SAMPLE_ENTRIES);
    const all = getAllAirportsFromDb();
    expect(all).toHaveLength(SAMPLE_ENTRIES.length);

    const icaos = all.map((a) => a.icao).sort();
    expect(icaos).toEqual(['EGLL', 'KJFK', 'KLAX', 'LFPG', 'OTHH']);
  });

  it('getAllAirportsFromDb preserves IATA codes needed for short VATSIM callsigns', () => {
    insertAirports([SAMPLE_ENTRIES[0]!]);

    const all = getAllAirportsFromDb();

    expect(all[0]?.icao).toBe('KJFK');
    expect(all[0]?.iataCode).toBe('JFK');
  });

  it('getAllAirportsFromDb returns empty array when table is empty', () => {
    expect(getAllAirportsFromDb()).toEqual([]);
  });

  // ---- coordinate round-trip ----

  it('coordinates survive the insert/query round-trip within float tolerance', () => {
    const entry = makeEntry({
      icao: 'KJFK',
      name: 'John F Kennedy Intl',
      lat: 40.639925,
      lon: -73.778694,
    });
    insertAirports([entry]);

    const all = getAllAirportsFromDb();
    const kjfk = all.find((a) => a.icao === 'KJFK');
    expect(kjfk).toBeDefined();
    expect(kjfk!.lat).toBeCloseTo(40.639925, 4);
    expect(kjfk!.lon).toBeCloseTo(-73.778694, 4);
  });

  // ---- Airport type mapping ----

  it('preserves airport type (land/seaplane/heliport) through the round-trip', () => {
    const entries = [
      makeEntry({ icao: 'TEST', type: 'land', lat: 10, lon: 10 }),
      makeEntry({ icao: 'TSEA', type: 'seaplane', lat: 20, lon: 20 }),
      makeEntry({ icao: 'THEL', type: 'heliport', lat: 30, lon: 30 }),
    ];
    insertAirports(entries);

    const all = getAllAirportsFromDb();
    const byIcao = Object.fromEntries(all.map((a) => [a.icao, a]));

    expect(byIcao['TEST']?.type).toBe('land');
    expect(byIcao['TSEA']?.type).toBe('seaplane');
    expect(byIcao['THEL']?.type).toBe('heliport');
  });

  // ---- surfaceType derivation ----

  it('derives surfaceType paved for primarySurfaceType=2 (concrete)', () => {
    insertAirports([makeEntry({ icao: 'PAVED', primarySurfaceType: 2, lat: 1, lon: 1 })]);
    const all = getAllAirportsFromDb();
    expect(all[0]?.surfaceType).toBe('paved');
  });

  it('derives surfaceType unpaved for primarySurfaceType=3 (turf)', () => {
    insertAirports([makeEntry({ icao: 'UNVPD', primarySurfaceType: 3, lat: 1, lon: 1 })]);
    const all = getAllAirportsFromDb();
    expect(all[0]?.surfaceType).toBe('unpaved');
  });

  it('derives surfaceType water for primarySurfaceType=13', () => {
    insertAirports([makeEntry({ icao: 'WATER', primarySurfaceType: 13, lat: 1, lon: 1 })]);
    const all = getAllAirportsFromDb();
    expect(all[0]?.surfaceType).toBe('water');
  });

  // ---- clearAirports ----

  it('clearAirports removes all entries', () => {
    insertAirports(SAMPLE_ENTRIES);
    expect(getAirportCount()).toBe(SAMPLE_ENTRIES.length);

    clearAirports();
    expect(getAirportCount()).toBe(0);
    expect(getAllAirportsFromDb()).toEqual([]);
  });

  it('clearAirports is idempotent on an already-empty table', () => {
    clearAirports();
    expect(getAirportCount()).toBe(0);
  });

  // ---- chunked inserts ----

  it('handles batch insert of more than 500 airports in one call', () => {
    const large = Array.from({ length: 650 }, (_, i) =>
      makeEntry({ icao: `A${String(i).padStart(4, '0')}`, lat: i * 0.01, lon: i * 0.01 })
    );
    insertAirports(large);
    expect(getAirportCount()).toBe(650);
  });

  // ---- persistDatabase (saveDb no-op mock) ----

  it('persistDatabase does not throw', () => {
    expect(() => persistDatabase()).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Custom scenery airport tests
// ---------------------------------------------------------------------------

describe('custom scenery airports', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  // ---- insertCustomAirports ----

  it('insertCustomAirports inserts into the custom table and airports are queryable', () => {
    const customKJFK = makeEntry({
      icao: 'KJFK',
      name: 'KJFK Custom Scenery',
      lat: 40.639925,
      lon: -73.778694,
    });

    insertCustomAirports([customKJFK]);

    const all = getAllAirportsFromDb();
    expect(all).toHaveLength(1);
    expect(all[0]?.icao).toBe('KJFK');
    expect(all[0]?.name).toBe('KJFK Custom Scenery');
  });

  // ---- clearCustomAirports ----

  it('clearCustomAirports removes custom airports but leaves global airports intact', () => {
    const globalEntry = makeEntry({
      icao: 'EGLL',
      name: 'London Heathrow',
      lat: 51.4775,
      lon: -0.4614,
    });
    const customEntry = makeEntry({
      icao: 'KJFK',
      name: 'KJFK Custom',
      lat: 40.639925,
      lon: -73.778694,
    });

    insertAirports([globalEntry]);
    insertCustomAirports([customEntry]);

    expect(getAllAirportsFromDb()).toHaveLength(2);

    clearCustomAirports();

    const remaining = getAllAirportsFromDb();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.icao).toBe('EGLL');
  });

  // ---- Override behavior ----

  it('custom airport overrides global airport with the same ICAO', () => {
    const globalKJFK = makeEntry({
      icao: 'KJFK',
      name: 'John F Kennedy Intl',
      lat: 40.639925,
      lon: -73.778694,
    });
    const customKJFK = makeEntry({
      icao: 'KJFK',
      name: 'KJFK Custom Scenery Enhanced',
      lat: 40.641,
      lon: -73.781,
    });

    insertAirports([globalKJFK]);
    insertCustomAirports([customKJFK]);

    const all = getAllAirportsFromDb();
    // Only one KJFK should appear
    const kjfkEntries = all.filter((a) => a.icao === 'KJFK');
    expect(kjfkEntries).toHaveLength(1);
    // Custom version wins
    expect(kjfkEntries[0]?.name).toBe('KJFK Custom Scenery Enhanced');
    expect(kjfkEntries[0]?.isCustom).toBe(true);
  });

  // ---- Custom-only airport ----

  it('custom-only airport (no global counterpart) appears in getAllAirportsFromDb', () => {
    const customOnly = makeEntry({
      icao: 'ZZZZ',
      name: 'Custom Only Airport',
      lat: 10,
      lon: 20,
    });

    insertCustomAirports([customOnly]);

    const all = getAllAirportsFromDb();
    expect(all).toHaveLength(1);
    expect(all[0]?.icao).toBe('ZZZZ');
    expect(all[0]?.isCustom).toBe(true);
  });

  // ---- Count behavior ----

  it('getAirportCount reflects only global airports (custom table is separate)', () => {
    const globalEntries = [
      makeEntry({ icao: 'EGLL', lat: 51.4775, lon: -0.4614 }),
      makeEntry({ icao: 'LFPG', lat: 49.0097, lon: 2.5478 }),
    ];
    const customEntry = makeEntry({ icao: 'KJFK', lat: 40.639925, lon: -73.778694 });

    insertAirports(globalEntries);
    insertCustomAirports([customEntry]);

    // getAirportCount counts only the global airports table
    expect(getAirportCount()).toBe(2);

    // But getAllAirportsFromDb merges both tables
    expect(getAllAirportsFromDb()).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// Cache invalidation tests
// ---------------------------------------------------------------------------

describe('detectAptFileChanges cache invalidation', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  it('indicates rescan needed when no cached meta exists', () => {
    const currentFiles = [{ path: '/xplane/apt.dat', mtime: 1000 }];
    const result = detectAptFileChanges(currentFiles);

    expect(result.needsReload).toBe(true);
    expect(result.newFiles).toContain('/xplane/apt.dat');
    expect(result.changedFiles).toHaveLength(0);
    expect(result.deletedFiles).toHaveLength(0);
  });

  it('indicates no rescan needed when cached mtime matches current mtime', () => {
    // Seed the database with matching metadata
    updateStoredFileMeta(
      [{ path: '/xplane/apt.dat', mtime: 1000 }],
      new Map([['/xplane/apt.dat', 42]])
    );

    const currentFiles = [{ path: '/xplane/apt.dat', mtime: 1000 }];
    const result = detectAptFileChanges(currentFiles);

    expect(result.needsReload).toBe(false);
    expect(result.newFiles).toHaveLength(0);
    expect(result.changedFiles).toHaveLength(0);
    expect(result.deletedFiles).toHaveLength(0);
  });

  it('indicates rescan needed when cached mtime differs from current mtime', () => {
    // Seed with an older mtime
    updateStoredFileMeta(
      [{ path: '/xplane/apt.dat', mtime: 999 }],
      new Map([['/xplane/apt.dat', 42]])
    );

    const currentFiles = [{ path: '/xplane/apt.dat', mtime: 1000 }];
    const result = detectAptFileChanges(currentFiles);

    expect(result.needsReload).toBe(true);
    expect(result.changedFiles).toContain('/xplane/apt.dat');
    expect(result.newFiles).toHaveLength(0);
    expect(result.deletedFiles).toHaveLength(0);
  });

  it('indicates rescan needed when a new file appears that is not in cache', () => {
    // Seed with only one file
    updateStoredFileMeta(
      [{ path: '/xplane/global/apt.dat', mtime: 500 }],
      new Map([['/xplane/global/apt.dat', 10]])
    );

    // Now two files are present — the second one is new
    const currentFiles = [
      { path: '/xplane/global/apt.dat', mtime: 500 },
      { path: '/xplane/custom/apt.dat', mtime: 800 },
    ];
    const result = detectAptFileChanges(currentFiles);

    expect(result.needsReload).toBe(true);
    expect(result.newFiles).toContain('/xplane/custom/apt.dat');
    expect(result.changedFiles).toHaveLength(0);
    expect(result.deletedFiles).toHaveLength(0);
  });

  it('indicates rescan needed when a cached file has been deleted', () => {
    // Seed with two files
    updateStoredFileMeta(
      [
        { path: '/xplane/global/apt.dat', mtime: 500 },
        { path: '/xplane/custom/apt.dat', mtime: 800 },
      ],
      new Map([
        ['/xplane/global/apt.dat', 10],
        ['/xplane/custom/apt.dat', 5],
      ])
    );

    // Only one file remains on disk
    const currentFiles = [{ path: '/xplane/global/apt.dat', mtime: 500 }];
    const result = detectAptFileChanges(currentFiles);

    expect(result.needsReload).toBe(true);
    expect(result.deletedFiles).toContain('/xplane/custom/apt.dat');
    expect(result.changedFiles).toHaveLength(0);
    expect(result.newFiles).toHaveLength(0);
  });
});
