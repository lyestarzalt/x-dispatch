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
import type {
  Airport,
  AirportProgressCallback,
  AirportSourceBreakdown,
  AptFileInfo,
} from '../types';
import {
  clearAirports,
  clearCustomAirports,
  detectAptFileChanges,
  getAirportBreakdown,
  getAirportCount,
  getAllAirportsFromDb,
  getStoredAirportCountEstimate,
  getStoredFileMeta,
  insertAirports,
  insertCustomAirports,
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
 * Sync airport cache with disk.
 * Compares apt.dat file mtimes against stored metadata — if anything
 * changed (new/modified/deleted scenery), rebuilds the entire airport DB
 * from Global Airports + Custom Scenery. Otherwise returns cached data.
 */
export async function syncAirportCache(
  xplanePath: string,
  onProgress?: AirportProgressCallback
): Promise<AirportLoadResult> {
  onProgress?.({ phase: 'cache-check' });

  const currentFiles = getCurrentAptFiles(xplanePath);
  const changes = detectAptFileChanges(currentFiles);

  if (!changes.needsReload) {
    logger.data.info('Airport cache is valid, skipping reload');
    onProgress?.({ phase: 'cache-valid' });
    const breakdown = getAirportBreakdown();
    const count = getAirportCount();
    onProgress?.({ phase: 'done', count, fromCache: true });
    return { count, breakdown, fromCache: true };
  }

  // Determine if this is first launch or scenery change
  const storedMeta = getStoredFileMeta();
  const reason = storedMeta.size === 0 ? 'first-launch' : 'scenery-changed';
  onProgress?.({ phase: 'cache-stale', reason });

  logCacheChanges(changes);

  // Get previous count estimate for progress bar
  const estimated = getStoredAirportCountEstimate() || undefined;

  // Load from files
  const startTime = Date.now();

  // 1. Load Global Airports (base layer)
  const globalResult = await loadGlobalAirports(xplanePath, onProgress, estimated);
  const allAirports = globalResult.airports;
  const globalIcaos = new Set(globalResult.airports.keys());

  // 2. Load Custom Scenery (overrides)
  const customResult = await loadCustomSceneryAirports(xplanePath, onProgress);
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

  // 4. Store in database — global and custom in separate tables
  onProgress?.({ phase: 'inserting' });
  const insertStart = Date.now();
  clearAirports();
  insertAirports(Array.from(globalResult.airports.values()));
  insertCustomAirports(Array.from(customResult.airports.values()));
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

  onProgress?.({ phase: 'done', count: allAirports.size, fromCache: false });

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
function logCacheChanges(cacheCheck: ReturnType<typeof detectAptFileChanges>): void {
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

/**
 * Quick check: have any apt.dat files changed since last sync?
 * Synchronous — compares file mtimes on disk vs stored in apt_file_meta.
 */
export function hasAptFileChanges(xplanePath: string): boolean {
  const currentFiles = getCurrentAptFiles(xplanePath);
  return detectAptFileChanges(currentFiles).needsReload;
}

// ============================================================================
// Incremental Custom Scenery Resync
// ============================================================================

/**
 * Fast resync of custom scenery airports only.
 * Skips re-parsing the Global Airports file — only re-parses custom scenery
 * apt.dat files and updates the airports_custom table.
 * Returns the count difference (positive = added, negative = removed).
 */
export async function resyncCustomScenery(
  xplanePath: string
): Promise<{ count: number; diff: number }> {
  const startTime = Date.now();

  // Get current custom airport count
  const beforeCount = getAllAirportsFromDb().filter((a) => a.isCustom).length;

  // Re-parse all custom scenery apt.dat files
  const customResult = await loadCustomSceneryAirports(xplanePath);

  // Replace custom airports in DB
  clearCustomAirports();
  insertCustomAirports(Array.from(customResult.airports.values()));

  // Update file metadata for custom scenery files only
  const customFiles = getCustomSceneryFileInfos(xplanePath);
  const airportCounts = new Map<string, number>();
  for (const [filePath, fileCount] of customResult.airportCounts) {
    airportCounts.set(filePath, fileCount);
  }
  updateStoredFileMeta(customFiles, airportCounts);

  persistDatabase();

  const afterCount = customResult.airports.size;
  const elapsed = Date.now() - startTime;
  logger.data.info(
    `Custom scenery resync: ${afterCount} airports from ${customResult.stats.totalPacks} packs in ${elapsed}ms`
  );

  return { count: afterCount, diff: afterCount - beforeCount };
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export { getAirportBreakdown, getDistinctCountries } from './airportCache';
