import { app } from 'electron';
import Database from 'better-sqlite3';
import { BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as path from 'path';
import logger from '../lib/logger';
import * as schema from './schema';

let db: BetterSQLite3Database<typeof schema> | null = null;
let sqlite: Database.Database | null = null;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'xplane-data.db');
}

export function getDb(): BetterSQLite3Database<typeof schema> {
  if (db) return db;

  const dbPath = getDbPath();
  logger.data.info(`Database initialized: ${dbPath}`);

  sqlite = new Database(dbPath, { fileMustExist: false });
  sqlite.pragma('journal_mode = WAL');

  db = drizzle(sqlite, { schema });

  initTables();

  return db;
}

function initTables(): void {
  if (!sqlite) return;

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS airports (
      icao TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lon REAL NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('land', 'seaplane', 'heliport')),
      elevation REAL,
      data TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_airports_coords ON airports(lat, lon);

    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

export function closeDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}

export function getSqlite(): Database.Database | null {
  return sqlite;
}

export * from './schema';
