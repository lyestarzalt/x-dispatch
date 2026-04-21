import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeTestDb, createTestDb, getTestDb } from '../../../tests/helpers/db';

describe('DB schema and migrations', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  it('should have all 9 expected tables', () => {
    const db = getTestDb();
    const rows = db.all<{ name: string }>(
      sql`SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`
    );
    const tableNames = rows.map((r) => r.name);

    const expectedTables = [
      '__drizzle_migrations',
      'airports',
      'airports_custom',
      'apt_file_meta',
      'airspaces',
      'airways',
      'metadata',
      'nav_file_meta',
      'navaids',
      'waypoints',
    ];

    for (const table of expectedTables) {
      expect(tableNames, `Expected table "${table}" to exist`).toContain(table);
    }
  });

  it('should have all expected columns on the airports table', () => {
    const db = getTestDb();
    const rows = db.all<{ name: string }>(sql`PRAGMA table_info(airports)`);
    const columnNames = rows.map((r) => r.name);

    const expectedColumns = [
      'icao',
      'name',
      'lat',
      'lon',
      'type',
      'elevation',
      'data',
      'country',
      'iata_code',
    ];
    for (const col of expectedColumns) {
      expect(columnNames, `Expected column "${col}" on airports`).toContain(col);
    }
  });

  it('should have all expected columns on the navaids table', () => {
    const db = getTestDb();
    const rows = db.all<{ name: string }>(sql`PRAGMA table_info(navaids)`);
    const columnNames = rows.map((r) => r.name);

    const expectedColumns = ['id', 'navaid_id', 'type', 'lat', 'lon', 'frequency'];
    for (const col of expectedColumns) {
      expect(columnNames, `Expected column "${col}" on navaids`).toContain(col);
    }
  });

  it('should support basic insert and query on the airports table', () => {
    const db = getTestDb();

    db.run(
      sql`INSERT INTO airports (icao, name, lat, lon, type) VALUES ('LFPG', 'Paris Charles de Gaulle', 49.0097, 2.5478, 'land')`
    );

    const rows = db.all<{ icao: string; name: string; lat: number; lon: number; type: string }>(
      sql`SELECT icao, name, lat, lon, type FROM airports WHERE icao = 'LFPG'`
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.icao).toBe('LFPG');
    expect(rows[0]!.name).toBe('Paris Charles de Gaulle');
    expect(rows[0]!.lat).toBeCloseTo(49.0097, 4);
    expect(rows[0]!.lon).toBeCloseTo(2.5478, 4);
    expect(rows[0]!.type).toBe('land');
  });

  it('should have run migrations without error (createTestDb succeeds)', async () => {
    // If createTestDb() in beforeEach threw, this test would not be reached.
    // The existence of the db instance confirms migrations ran successfully.
    const db = getTestDb();
    expect(db).toBeDefined();
  });
});
