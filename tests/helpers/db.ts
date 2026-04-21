/**
 * Test helper: in-memory sql.js database with Drizzle ORM and migrations.
 *
 * Usage:
 *   import { createTestDb, getTestDb, closeTestDb } from '../helpers/db';
 *
 *   beforeEach(async () => { await createTestDb(); });
 *   afterEach(() => { closeTestDb(); });
 *
 *   // In vi.mock('@/lib/db'):
 *   getDb: () => getTestDb()
 */
import { type SQLJsDatabase, drizzle } from 'drizzle-orm/sql-js';
import { migrate } from 'drizzle-orm/sql-js/migrator';
import path from 'path';
import initSqlJs from 'sql.js';
import * as schema from '@/lib/db/schema';

type SqlJsDatabase = import('sql.js').Database;

const MIGRATIONS_FOLDER = path.resolve(__dirname, '../../drizzle');

let db: SQLJsDatabase<typeof schema> | null = null;
let sqlite: SqlJsDatabase | null = null;

/**
 * Creates a fresh in-memory sql.js database, wraps it with Drizzle, and
 * runs all Drizzle migrations from the `drizzle/` folder.
 * Call this in `beforeEach` (or `beforeAll`) in test suites that need the DB.
 */
export async function createTestDb(): Promise<SQLJsDatabase<typeof schema>> {
  // Close any previously open instance to avoid leaks between tests
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }

  const SQL = await initSqlJs();
  sqlite = new SQL.Database(); // no-arg = in-memory DB
  db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return db;
}

/**
 * Returns the current test database instance.
 * Throws if `createTestDb()` has not been called yet.
 */
export function getTestDb(): SQLJsDatabase<typeof schema> {
  if (!db) {
    throw new Error('Test DB not initialized. Call createTestDb() first.');
  }
  return db;
}

/**
 * Closes the sql.js database and nulls all references.
 * Call this in `afterEach` (or `afterAll`) to release WASM memory.
 */
export function closeTestDb(): void {
  if (sqlite) {
    sqlite.close();
    sqlite = null;
    db = null;
  }
}
