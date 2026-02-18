/**
 * Airport Cache
 * SQLite caching for parsed airport data.
 * Tracks file modification times to invalidate cache when apt.dat files change.
 */
import { count, like } from 'drizzle-orm';
import * as fs from 'fs';
import { airports, aptFileMeta, getDb, saveDb } from '@/lib/db';
import logger from '@/lib/utils/logger';
import type {
  Airport,
  AirportSourceBreakdown,
  AptFileInfo,
  CacheCheckResult,
  ParsedAirportEntry,
} from '../types';

// ============================================================================
// File Metadata Operations
// ============================================================================

/**
 * Get file modification time in milliseconds
 */
export function getFileMtime(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor(stat.mtimeMs);
  } catch {
    return null;
  }
}

/**
 * Get stored file metadata from database
 */
export function getStoredFileMeta(): Map<string, number> {
  const db = getDb();
  const stored = db.select().from(aptFileMeta).all();
  const map = new Map<string, number>();
  for (const row of stored) {
    map.set(row.path, row.mtime);
  }
  return map;
}

/**
 * Check if cache needs to be reloaded based on file changes
 */
export function checkCacheValidity(currentFiles: AptFileInfo[]): CacheCheckResult {
  const stored = getStoredFileMeta();

  const changedFiles: string[] = [];
  const newFiles: string[] = [];
  const deletedFiles: string[] = [];

  const currentPaths = new Set(currentFiles.map((f) => f.path));

  // Check for changed or new files
  for (const file of currentFiles) {
    const storedMtime = stored.get(file.path);
    if (storedMtime === undefined) {
      newFiles.push(file.path);
    } else if (storedMtime !== file.mtime) {
      changedFiles.push(file.path);
    }
  }

  // Check for deleted files
  for (const storedPath of stored.keys()) {
    if (!currentPaths.has(storedPath)) {
      deletedFiles.push(storedPath);
    }
  }

  const needsReload = changedFiles.length > 0 || newFiles.length > 0 || deletedFiles.length > 0;

  return { needsReload, changedFiles, newFiles, deletedFiles };
}

/**
 * Update stored file metadata after successful load
 */
export function updateStoredFileMeta(
  files: AptFileInfo[],
  airportCounts: Map<string, number>
): void {
  const db = getDb();

  // Clear existing
  db.delete(aptFileMeta).run();

  // Insert current state
  const entries = files.map((f) => ({
    path: f.path,
    mtime: f.mtime,
    airportCount: airportCounts.get(f.path) ?? 0,
  }));

  if (entries.length > 0) {
    db.insert(aptFileMeta).values(entries).run();
  }
}

// ============================================================================
// Airport Database Operations
// ============================================================================

/**
 * Clear all airports from database
 */
export function clearAirports(): void {
  const db = getDb();
  db.delete(airports).run();
}

/**
 * Batch insert airports into database
 */
export function insertAirports(airportEntries: ParsedAirportEntry[]): void {
  const db = getDb();

  const airportArray = airportEntries.map((a) => ({
    icao: a.icao,
    name: a.name,
    lat: a.lat,
    lon: a.lon,
    type: a.type,
    elevation: a.elevation,
    data: a.data,
    sourceFile: a.sourceFile,
    city: a.city,
    country: a.country,
    iataCode: a.iataCode,
    faaCode: a.faaCode,
    regionCode: a.regionCode,
    state: a.state,
    transitionAlt: a.transitionAlt,
    transitionLevel: a.transitionLevel,
    towerServiceType: a.towerServiceType,
    driveOnLeft: a.driveOnLeft,
    guiLabel: a.guiLabel,
  }));

  // Batch insert in chunks of 500
  const CHUNK_SIZE = 500;
  for (let i = 0; i < airportArray.length; i += CHUNK_SIZE) {
    const chunk = airportArray.slice(i, i + CHUNK_SIZE);
    db.insert(airports).values(chunk).run();
  }
}

/**
 * Save database to disk
 */
export function persistDatabase(): void {
  saveDb();
}

/**
 * Get all airports from database
 */
export function getAllAirportsFromDb(): Airport[] {
  const db = getDb();
  const results = db
    .select({
      icao: airports.icao,
      name: airports.name,
      lat: airports.lat,
      lon: airports.lon,
      type: airports.type,
    })
    .from(airports)
    .all();

  return results as Airport[];
}

/**
 * Get airport count from database
 */
export function getAirportCount(): number {
  const db = getDb();
  const result = db.select({ count: count() }).from(airports).get();
  return result?.count || 0;
}

// ============================================================================
// Source Breakdown Operations
// ============================================================================

/**
 * Compute airport breakdown from database (used when cache is valid)
 */
export function computeBreakdownFromDb(): AirportSourceBreakdown {
  const db = getDb();

  // Count total airports
  const totalResult = db.select({ count: count() }).from(airports).get();
  const total = totalResult?.count || 0;

  // Count custom scenery airports (sourceFile contains 'Custom Scenery')
  const customResult = db
    .select({ count: count() })
    .from(airports)
    .where(like(airports.sourceFile, '%Custom Scenery%'))
    .get();
  const customCount = customResult?.count || 0;

  // Count custom scenery packs from aptFileMeta
  const customPacks = db
    .select()
    .from(aptFileMeta)
    .where(like(aptFileMeta.path, '%Custom Scenery%'))
    .all();

  const breakdown = {
    globalAirports: total - customCount,
    customScenery: customCount,
    customSceneryPacks: customPacks.length,
  };

  logger.data.info(
    `Airport breakdown from cache: ${breakdown.globalAirports} Global, ${customCount} Custom (${customPacks.length} packs)`
  );

  return breakdown;
}
