/**
 * Airport Data Module
 * Orchestrates loading airports from Global Airports and Custom Scenery.
 *
 * Data flow:
 * 1. Check cache validity (file modification times)
 * 2. If cache valid → return from SQLite
 * 3. If cache stale:
 *    a. Load Global Airports apt.dat (base layer)
 *    b. Load Custom Scenery apt.dat files (overrides)
 *    c. Merge (Custom overrides Global)
 *    d. Batch insert into SQLite
 *    e. Update file metadata cache
 */
import logger from '@/lib/utils/logger';
import type { Airport, AirportSourceBreakdown, AptFileInfo } from '../types';
import {
  checkCacheValidity,
  clearAirports,
  computeBreakdownFromDb,
  getAirportCount,
  getAllAirportsFromDb,
  insertAirports,
  persistDatabase,
  updateStoredFileMeta,
} from './airportCache';
import {
  findCustomSceneryAptFiles,
  getCustomSceneryFileInfos,
  loadCustomSceneryAirports,
} from './customSceneryLoader';
import { getGlobalAptFileInfo, loadGlobalAirports } from './globalAptLoader';

// ============================================================================
// Public Types
// ============================================================================

export interface AirportLoadResult {
  count: number;
  breakdown: AirportSourceBreakdown;
  fromCache: boolean;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Load all airports from X-Plane installation
 * Handles caching and merging of Global + Custom Scenery
 */
export async function loadAirports(xplanePath: string): Promise<AirportLoadResult> {
  // Gather current file infos
  const currentFiles = getCurrentAptFiles(xplanePath);

  // Check cache validity
  const cacheCheck = checkCacheValidity(currentFiles);

  if (!cacheCheck.needsReload) {
    logger.data.info('Airport cache is valid, skipping reload');
    const breakdown = computeBreakdownFromDb();
    const count = getAirportCount();
    return { count, breakdown, fromCache: true };
  }

  // Log what changed
  logCacheChanges(cacheCheck);

  // Load from files
  const startTime = Date.now();

  // 1. Load Global Airports (base layer)
  const globalResult = await loadGlobalAirports(xplanePath);
  const allAirports = globalResult.airports;
  const globalIcaos = new Set(globalResult.airports.keys());

  // 2. Load Custom Scenery (overrides)
  const customResult = await loadCustomSceneryAirports(xplanePath);
  const customIcaos = new Set<string>();

  for (const [icao, airport] of customResult.airports) {
    allAirports.set(icao, airport); // Override global
    customIcaos.add(icao);
  }

  // 3. Calculate breakdown
  const globalOnlyCount = [...globalIcaos].filter((icao) => !customIcaos.has(icao)).length;
  const breakdown: AirportSourceBreakdown = {
    globalAirports: globalOnlyCount,
    customScenery: customIcaos.size,
    customSceneryPacks: customResult.stats.totalPacks,
  };

  logger.data.info(
    `Airport breakdown: ${globalOnlyCount} from Global, ${customIcaos.size} from Custom Scenery ` +
      `(${customResult.stats.totalPacks} packs)`
  );

  // 4. Store in database
  const insertStart = Date.now();
  clearAirports();
  insertAirports(Array.from(allAirports.values()));
  const insertTime = Date.now() - insertStart;
  logger.data.info(`Batch inserted ${allAirports.size} airports in ${insertTime}ms`);

  // 5. Update file metadata cache
  const airportCounts = new Map<string, number>();
  if (globalResult.fileInfo) {
    airportCounts.set(globalResult.fileInfo.path, globalResult.airports.size);
  }
  for (const [path, count] of customResult.airportCounts) {
    airportCounts.set(path, count);
  }
  updateStoredFileMeta(currentFiles, airportCounts);

  // 6. Persist
  persistDatabase();

  const elapsed = Date.now() - startTime;
  logger.data.info(`Stored ${allAirports.size} total airports in ${elapsed}ms`);

  return {
    count: allAirports.size,
    breakdown,
    fromCache: false,
  };
}

/**
 * Get all airports from database
 */
export function getAllAirports(): Airport[] {
  return getAllAirportsFromDb();
}

/**
 * Get Custom Scenery apt.dat file paths
 */
export function getCustomSceneryAptFiles(xplanePath: string): string[] {
  return findCustomSceneryAptFiles(xplanePath);
}

// ============================================================================
// Internal Helpers
// ============================================================================

/**
 * Get all current apt.dat files with their modification times
 */
function getCurrentAptFiles(xplanePath: string): AptFileInfo[] {
  const files: AptFileInfo[] = [];

  // Global apt.dat
  const globalInfo = getGlobalAptFileInfo(xplanePath);
  if (globalInfo) {
    files.push(globalInfo);
  }

  // Custom Scenery apt.dat files
  const customInfos = getCustomSceneryFileInfos(xplanePath);
  files.push(...customInfos);

  return files;
}

/**
 * Log cache change details
 */
function logCacheChanges(cacheCheck: ReturnType<typeof checkCacheValidity>): void {
  if (cacheCheck.changedFiles.length > 0) {
    logger.data.info(`Changed apt.dat files: ${cacheCheck.changedFiles.length}`);
  }
  if (cacheCheck.newFiles.length > 0) {
    logger.data.info(`New apt.dat files: ${cacheCheck.newFiles.length}`);
  }
  if (cacheCheck.deletedFiles.length > 0) {
    logger.data.info(`Deleted apt.dat files: ${cacheCheck.deletedFiles.length}`);
  }
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { computeBreakdownFromDb } from './airportCache';
