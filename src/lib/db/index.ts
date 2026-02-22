import { app } from 'electron';
import { type SQLJsDatabase as DrizzleDatabase, drizzle } from 'drizzle-orm/sql-js';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import * as schema from './schema';

// Dynamic require for sql.js to avoid bundling issues
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs = require('sql.js') as typeof import('sql.js').default;
type SqlJsDatabase = import('sql.js').Database;

let db: DrizzleDatabase<typeof schema> | null = null;
let sqlite: SqlJsDatabase | null = null;
let dbPath: string = '';

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'xplane-data.db');
}

export async function initDb(): Promise<DrizzleDatabase<typeof schema>> {
  if (db) return db;

  dbPath = getDbPath();
  logger.data.info(`Database initializing: ${dbPath}`);

  const SQL = await initSqlJs();

  // Load existing database or create new one
  let data: Buffer | undefined;
  if (fs.existsSync(dbPath)) {
    data = fs.readFileSync(dbPath);
  }

  sqlite = new SQL.Database(data);
  db = drizzle(sqlite, { schema });

  initTables();
  logger.data.info(`Database initialized: ${dbPath}`);

  return db;
}

export function getDb(): DrizzleDatabase<typeof schema> {
  if (!db) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return db;
}

/**
 * Check if a column exists in a table
 */
function columnExists(sqlite: SqlJsDatabase, table: string, column: string): boolean {
  const result = sqlite.exec(`PRAGMA table_info(${table});`);
  if (result.length === 0) return false;

  const columns = result[0].values.map((row) => row[1] as string);
  return columns.includes(column);
}

/**
 * Migration: Add bounding box columns to airspaces table
 * Enables efficient spatial queries consistent with navaids/waypoints
 */
function migrateAirspacesBoundingBox(sqlite: SqlJsDatabase): void {
  // Check if columns exist
  const columnsExist = columnExists(sqlite, 'airspaces', 'min_lat');

  if (!columnsExist) {
    logger.data.info('Migrating airspaces table: adding bounding box columns');

    // Add bounding box columns
    sqlite.run(`ALTER TABLE airspaces ADD COLUMN min_lat REAL;`);
    sqlite.run(`ALTER TABLE airspaces ADD COLUMN max_lat REAL;`);
    sqlite.run(`ALTER TABLE airspaces ADD COLUMN min_lon REAL;`);
    sqlite.run(`ALTER TABLE airspaces ADD COLUMN max_lon REAL;`);
  }

  // Create spatial index
  sqlite.run(
    `CREATE INDEX IF NOT EXISTS idx_airspaces_bounds ON airspaces(min_lat, max_lat, min_lon, max_lon);`
  );

  // Check if existing data has NULL bounding boxes (needs re-import)
  const result = sqlite.exec(
    `SELECT COUNT(*) FROM airspaces WHERE min_lat IS NULL AND (SELECT COUNT(*) FROM airspaces) > 0;`
  );
  const nullCount = result.length > 0 ? (result[0].values[0][0] as number) : 0;

  if (nullCount > 0) {
    logger.data.info(
      `Airspaces migration: ${nullCount} records missing bounding boxes, clearing cache`
    );
    sqlite.run(`DELETE FROM nav_file_meta WHERE data_type = 'airspaces';`);
    sqlite.run(`DELETE FROM airspaces;`);
    logger.data.info('Migration complete: airspaces will reload with spatial indexing');
  }
}

function initTables(): void {
  if (!sqlite) return;

  // Create tables if they don't exist (preserves cached data)
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS airports (
      icao TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('land', 'seaplane', 'heliport')),
      elevation INTEGER,
      data TEXT,
      source_file TEXT,
      city TEXT,
      country TEXT,
      iata_code TEXT,
      faa_code TEXT,
      region_code TEXT,
      state TEXT,
      transition_alt INTEGER,
      transition_level TEXT,
      tower_service_type TEXT,
      drive_on_left INTEGER,
      gui_label TEXT
    );
  `);

  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_coords ON airports(lat, lon);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata_code);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(country);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airports_region ON airports(region_code);`);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS apt_file_meta (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL,
      airport_count INTEGER
    );
  `);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Navigation data tables
  sqlite.run(`
    CREATE TABLE IF NOT EXISTS nav_file_meta (
      path TEXT PRIMARY KEY,
      mtime INTEGER NOT NULL,
      record_count INTEGER,
      data_type TEXT NOT NULL,
      source_type TEXT NOT NULL DEFAULT 'unknown'
    );
  `);

  // Migration: Add source_type column if it doesn't exist (for existing databases)
  try {
    sqlite.run(`ALTER TABLE nav_file_meta ADD COLUMN source_type TEXT NOT NULL DEFAULT 'unknown';`);
  } catch {
    // Column already exists, ignore error
  }

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS navaids (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      navaid_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      elevation INTEGER,
      frequency INTEGER,
      range INTEGER,
      magnetic_variation REAL,
      region TEXT,
      country TEXT,
      bearing REAL,
      associated_airport TEXT,
      associated_runway TEXT,
      glidepath_angle REAL,
      course REAL,
      length_offset REAL,
      threshold_crossing_height REAL,
      ref_path_identifier TEXT,
      approach_performance TEXT
    );
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_navaids_coords ON navaids(lat, lon);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_navaids_type ON navaids(type);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_navaids_navaid_id ON navaids(navaid_id);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_navaids_airport ON navaids(associated_airport);`);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS waypoints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      waypoint_id TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      region TEXT NOT NULL,
      area_code TEXT NOT NULL,
      description TEXT
    );
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_waypoints_coords ON waypoints(lat, lon);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_waypoints_waypoint_id ON waypoints(waypoint_id);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_waypoints_region ON waypoints(region);`);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS airways (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      from_fix TEXT NOT NULL,
      from_region TEXT NOT NULL,
      from_navaid_type INTEGER NOT NULL,
      to_fix TEXT NOT NULL,
      to_region TEXT NOT NULL,
      to_navaid_type INTEGER NOT NULL,
      is_high INTEGER NOT NULL,
      base_fl INTEGER NOT NULL,
      top_fl INTEGER NOT NULL,
      direction INTEGER NOT NULL
    );
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airways_name ON airways(name);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airways_from_fix ON airways(from_fix);`);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airways_to_fix ON airways(to_fix);`);

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS airspaces (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      airspace_class TEXT NOT NULL,
      upper_limit TEXT,
      lower_limit TEXT,
      coordinates TEXT NOT NULL,
      min_lat REAL,
      max_lat REAL,
      min_lon REAL,
      max_lon REAL
    );
  `);
  sqlite.run(`CREATE INDEX IF NOT EXISTS idx_airspaces_class ON airspaces(airspace_class);`);

  // Migration: Add bounding box columns for spatial queries (consistent with navaids/waypoints)
  migrateAirspacesBoundingBox(sqlite);
}

export function saveDb(): void {
  if (!sqlite || !dbPath) return;

  const data = sqlite.export();
  const buffer = Buffer.from(data);

  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(dbPath, buffer);
  logger.data.info('Database saved to disk');
}

export function closeDb(): void {
  if (sqlite) {
    saveDb();
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export * from './schema';
