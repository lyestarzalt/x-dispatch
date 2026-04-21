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
const { insertAirports, getAllAirportsFromDb, getAirportCount, clearAirports, persistDatabase } =
  await import('./airportCache');

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
