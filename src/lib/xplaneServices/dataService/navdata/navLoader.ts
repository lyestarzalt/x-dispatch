/**
 * Navigation Data Loader
 * Handles loading of navigation data files (navaids, waypoints, airspaces, airways, etc.)
 * Uses SQLite caching with mtime-based invalidation (same pattern as airports).
 *
 * Data flow:
 * 1. Check cache validity (file modification times)
 * 2. If cache valid → return from SQLite
 * 3. If cache stale:
 *    a. Parse file
 *    b. Batch insert into SQLite
 *    c. Update file metadata cache
 */
import * as fs from 'fs';
import { parseAirspaces } from '@/lib/parsers/nav/airspaceParser';
import { parseAirways } from '@/lib/parsers/nav/airwayParser';
import { parseAirportMetadata } from '@/lib/parsers/nav/aptMetaParser';
import { parseATCData } from '@/lib/parsers/nav/atcParser';
import { parseHoldingPatterns } from '@/lib/parsers/nav/holdParser';
import { parseNavaids } from '@/lib/parsers/nav/navaidParser';
import { parseWaypoints } from '@/lib/parsers/nav/waypointParser';
import type { ParseResult } from '@/lib/parsers/types';
import logger from '@/lib/utils/logger';
import type {
  ATCController,
  AirportMetadata,
  Airspace,
  AirwaySegment,
  HoldingPattern,
  Navaid,
  Waypoint,
} from '@/types/navigation';
import {
  getAirspaceDataPath,
  getAirwayDataPath,
  getAptMetaDataPath,
  getAtcDataPath,
  getFixDataPath,
  getHoldDataPath,
  getNavDataPath,
  getUserFixDataPath,
  getUserNavDataPath,
} from '../paths';
import {
  checkNavCacheValidity,
  checkUserNavFileValidity,
  clearAirspaces,
  clearAirways,
  clearNavaids,
  clearWaypoints,
  detectSourceType,
  getAirspaceCount,
  getAirwayCount,
  getNavaidCount,
  getWaypointCount,
  insertAirspaces,
  insertAirways,
  insertNavaids,
  insertWaypoints,
  updateNavFileMeta,
  updateUserNavFileMeta,
} from './navCache';

// ============================================================================
// Types
// ============================================================================

export interface NavLoadResult<T> {
  data: T;
  /** Number of records now in the cache. On a cache hit `data` stays empty —
   * the tables are queried from SQLite on demand — so counts come from here. */
  count: number;
  loaded: boolean;
  source: string | null;
  fromCache: boolean;
}

// ============================================================================
// Navaids Loading
// ============================================================================

/** A skipped line is a lost record; the first few reasons tell a bad file from a bad bound. */
function warnSkipped(label: string, result: Pick<ParseResult<unknown>, 'errors' | 'stats'>): void {
  const { errors, stats } = result;
  if (stats.skipped === 0 && errors.length === 0) return;
  const samples = errors
    .map((e) => (e.line === undefined ? e.message : `line ${e.line}: ${e.message}`))
    .join('; ');
  logger.data.warn(`${label}: ${stats.skipped} of ${stats.total} lines skipped. ${samples}`);
}

/**
 * Combined cache validity for a data type whose load merges an optional pilot file on top of
 * the main one. Both the loaders below and the startup fast path in XPlaneDataManager use it,
 * so they agree on when the merged set is stale.
 */
export function checkMergedNavValidity(
  xplanePath: string,
  dataType: 'navaids' | 'waypoints'
): ReturnType<typeof checkNavCacheValidity> {
  const navaids = dataType === 'navaids';
  const mainPath = navaids ? getNavDataPath(xplanePath) : getFixDataPath(xplanePath);
  const userPath = navaids ? getUserNavDataPath(xplanePath) : getUserFixDataPath(xplanePath);

  const main = checkNavCacheValidity(mainPath, dataType);
  if (main.needsReload) return main;
  return checkUserNavFileValidity(userPath, navaids ? 'user-navaids' : 'user-waypoints');
}

/**
 * Parse an optional pilot-created file (user_nav.dat / user_fix.dat) with the same parser as
 * its main file. A missing file is an empty list — X-Plane adds these on top of the defaults.
 */
async function parseUserFile<T>(
  userPath: string,
  label: string,
  parse: (content: string) => ParseResult<T[]>
): Promise<T[]> {
  if (!fs.existsSync(userPath)) return [];
  const content = await fs.promises.readFile(userPath, 'utf-8');
  const result = parse(content);
  warnSkipped(label, result);
  return result.data;
}

/**
 * Load navaids from earth_nav.dat, plus any pilot-created ones in user_nav.dat, with caching
 */
export async function loadNavaids(xplanePath: string): Promise<NavLoadResult<Navaid[]>> {
  const navPath = getNavDataPath(xplanePath);
  const userNavPath = getUserNavDataPath(xplanePath);

  if (!fs.existsSync(navPath)) {
    logger.data.warn(`earth_nav.dat not found: ${navPath}`);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }

  // Check cache validity — of the main file and of the optional user file
  const cacheCheck = checkMergedNavValidity(xplanePath, 'navaids');
  const sourceType = detectSourceType(navPath);

  if (!cacheCheck.needsReload) {
    const count = getNavaidCount();
    logger.data.info(`Navaids cache valid (${sourceType}), ${count} in database`);
    return {
      data: [],
      count,
      loaded: true,
      source: navPath,
      fromCache: true,
    };
  }

  // Get file size for logging
  const fileStat = fs.statSync(navPath);
  const fileSizeMB = (fileStat.size / (1024 * 1024)).toFixed(1);
  logger.data.info(
    `Navaids cache stale (${cacheCheck.reason}), reloading ${fileSizeMB}MB from ${sourceType}`
  );

  // Parse the main file, then append the pilot's own navaids (#320)
  const startTime = Date.now();
  const content = await fs.promises.readFile(navPath, 'utf-8');
  const { data: mainData, errors, stats } = parseNavaids(content);
  const userData = await parseUserFile(userNavPath, 'User navaids', parseNavaids);
  const data = userData.length > 0 ? [...mainData, ...userData] : mainData;
  if (userData.length > 0) {
    logger.data.info(`Merged ${userData.length} pilot navaids from user_nav.dat`);
  }

  warnSkipped('Navaids', { errors, stats });

  // Store in database
  const insertStart = Date.now();
  clearNavaids();
  await insertNavaids(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(navPath, 'navaids', data.length);
  updateUserNavFileMeta(userNavPath, 'user-navaids', userData.length);

  const elapsed = Date.now() - startTime;

  // Count navaids by type for detailed logging
  const typeCounts = new Map<string, number>();
  for (const nav of data) {
    typeCounts.set(nav.type, (typeCounts.get(nav.type) || 0) + 1);
  }
  const typeBreakdown = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => `${type}: ${count}`)
    .join(', ');

  logger.data.info(
    `Loaded ${stats.parsed} navaids in ${elapsed}ms (insert: ${insertTime}ms) - ${typeBreakdown}`
  );

  return { data, count: data.length, loaded: true, source: navPath, fromCache: false };
}

// ============================================================================
// Waypoints Loading
// ============================================================================

/**
 * Load waypoints from earth_fix.dat, plus any pilot-created ones in user_fix.dat, with caching
 */
export async function loadWaypoints(xplanePath: string): Promise<NavLoadResult<Waypoint[]>> {
  const fixPath = getFixDataPath(xplanePath);
  const userFixPath = getUserFixDataPath(xplanePath);

  if (!fs.existsSync(fixPath)) {
    logger.data.warn(`earth_fix.dat not found: ${fixPath}`);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }

  // Check cache validity — of the main file and of the optional user file
  const cacheCheck = checkMergedNavValidity(xplanePath, 'waypoints');
  const sourceType = detectSourceType(fixPath);

  if (!cacheCheck.needsReload) {
    const count = getWaypointCount();
    logger.data.info(`Waypoints cache valid (${sourceType}), ${count} in database`);
    return {
      data: [],
      count,
      loaded: true,
      source: fixPath,
      fromCache: true,
    };
  }

  // Get file size for logging
  const fileStat = fs.statSync(fixPath);
  const fileSizeMB = (fileStat.size / (1024 * 1024)).toFixed(1);
  logger.data.info(
    `Waypoints cache stale (${cacheCheck.reason}), reloading ${fileSizeMB}MB from ${sourceType}`
  );

  // Parse the main file, then append the pilot's own waypoints (#320)
  const startTime = Date.now();
  const content = await fs.promises.readFile(fixPath, 'utf-8');
  const { data: mainData, errors, stats } = parseWaypoints(content);
  const userData = await parseUserFile(userFixPath, 'User waypoints', parseWaypoints);
  const data = userData.length > 0 ? [...mainData, ...userData] : mainData;
  if (userData.length > 0) {
    logger.data.info(`Merged ${userData.length} pilot waypoints from user_fix.dat`);
  }

  warnSkipped('Waypoints', { errors, stats });

  // Store in database
  const insertStart = Date.now();
  clearWaypoints();
  await insertWaypoints(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(fixPath, 'waypoints', data.length);
  updateUserNavFileMeta(userFixPath, 'user-waypoints', userData.length);

  const elapsed = Date.now() - startTime;
  logger.data.info(`Loaded ${stats.parsed} waypoints in ${elapsed}ms (insert: ${insertTime}ms)`);

  return { data, count: data.length, loaded: true, source: fixPath, fromCache: false };
}

// ============================================================================
// Airways Loading
// ============================================================================

/**
 * Load airways from earth_awy.dat with caching
 */
export async function loadAirways(xplanePath: string): Promise<NavLoadResult<AirwaySegment[]>> {
  const awyPath = getAirwayDataPath(xplanePath);

  if (!fs.existsSync(awyPath)) {
    logger.data.warn(`earth_awy.dat not found: ${awyPath}`);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }

  // Check cache validity
  const cacheCheck = checkNavCacheValidity(awyPath, 'airways');
  const sourceType = detectSourceType(awyPath);

  if (!cacheCheck.needsReload) {
    const count = getAirwayCount();
    logger.data.info(`Airways cache valid (${sourceType}), ${count} in database`);
    return {
      data: [],
      count,
      loaded: true,
      source: awyPath,
      fromCache: true,
    };
  }

  // Get file size for logging
  const fileStat = fs.statSync(awyPath);
  const fileSizeMB = (fileStat.size / (1024 * 1024)).toFixed(1);
  logger.data.info(
    `Airways cache stale (${cacheCheck.reason}), reloading ${fileSizeMB}MB from ${sourceType}`
  );

  // Parse file
  const startTime = Date.now();
  const content = await fs.promises.readFile(awyPath, 'utf-8');
  const { data, errors, stats } = parseAirways(content);

  warnSkipped('Airways', { errors, stats });

  // Store in database
  const insertStart = Date.now();
  clearAirways();
  await insertAirways(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(awyPath, 'airways', data.length);

  const elapsed = Date.now() - startTime;
  logger.data.info(
    `Loaded ${stats.parsed} airway segments in ${elapsed}ms (insert: ${insertTime}ms)`
  );

  return { data, count: data.length, loaded: true, source: awyPath, fromCache: false };
}

// ============================================================================
// Airspaces Loading
// ============================================================================

/**
 * Load airspaces from airspace.txt with caching
 */
export async function loadAirspaces(xplanePath: string): Promise<NavLoadResult<Airspace[]>> {
  const airspacePath = getAirspaceDataPath(xplanePath);

  if (!fs.existsSync(airspacePath)) {
    logger.data.warn(`airspace.txt not found: ${airspacePath}`);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }

  // Check cache validity
  const cacheCheck = checkNavCacheValidity(airspacePath, 'airspaces');
  const sourceType = detectSourceType(airspacePath);

  if (!cacheCheck.needsReload) {
    const count = getAirspaceCount();
    // Safety check: if cache says valid but table is empty, force reload
    if (count > 0) {
      logger.data.info(`Airspaces cache valid (${sourceType}), ${count} in database`);
      return {
        data: [],
        count,
        loaded: true,
        source: airspacePath,
        fromCache: true,
      };
    }
    logger.data.warn(`Airspaces cache metadata valid but table empty, forcing reload`);
  }

  // Get file size for logging
  const fileStat = fs.statSync(airspacePath);
  const fileSizeMB = (fileStat.size / (1024 * 1024)).toFixed(1);
  logger.data.info(
    `Airspaces cache stale (${cacheCheck.reason}), reloading ${fileSizeMB}MB from ${sourceType}`
  );

  // Parse file
  const startTime = Date.now();
  const content = await fs.promises.readFile(airspacePath, 'utf-8');
  const { data, errors, stats } = parseAirspaces(content);

  warnSkipped('Airspaces', { errors, stats });

  // Store in database
  const insertStart = Date.now();
  clearAirspaces();
  await insertAirspaces(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(airspacePath, 'airspaces', data.length);

  const elapsed = Date.now() - startTime;
  logger.data.info(`Loaded ${stats.parsed} airspaces in ${elapsed}ms (insert: ${insertTime}ms)`);

  return { data, count: data.length, loaded: true, source: airspacePath, fromCache: false };
}

// ============================================================================
// Non-Cached Loaders (ATC, Holdings, AptMeta)
// These are smaller files and/or Navigraph-specific, so caching is less critical
// ============================================================================

/**
 * Load ATC data from Navigraph atc.dat (no caching - Navigraph only)
 */
export async function loadATCData(xplanePath: string): Promise<NavLoadResult<ATCController[]>> {
  const atcPath = getAtcDataPath(xplanePath);

  if (!atcPath) {
    logger.data.debug('ATC data file not found (Navigraph-only feature)');
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }

  try {
    const content = await fs.promises.readFile(atcPath, 'utf-8');
    const { data, errors, stats } = parseATCData(content);
    warnSkipped('ATC', { errors, stats });
    logger.data.info(`Loaded ${stats.parsed} ATC controllers in ${stats.timeMs}ms`);
    return { data, count: data.length, loaded: true, source: atcPath, fromCache: false };
  } catch (error) {
    logger.data.warn('Failed to load ATC data:', error);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }
}

/**
 * Load holding patterns from earth_hold.dat (no caching - smaller file)
 */
export async function loadHoldingPatterns(
  xplanePath: string
): Promise<NavLoadResult<HoldingPattern[]>> {
  const holdPath = getHoldDataPath(xplanePath);

  if (!fs.existsSync(holdPath)) {
    logger.data.debug(`earth_hold.dat not found: ${holdPath}`);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }

  try {
    const content = await fs.promises.readFile(holdPath, 'utf-8');
    const { data, errors, stats } = parseHoldingPatterns(content);
    warnSkipped('Holdings', { errors, stats });
    logger.data.info(`Loaded ${stats.parsed} holding patterns in ${stats.timeMs}ms`);
    return { data, count: data.length, loaded: true, source: holdPath, fromCache: false };
  } catch (error) {
    logger.data.warn('Failed to load holding patterns:', error);
    return { data: [], count: 0, loaded: false, source: null, fromCache: false };
  }
}

/**
 * Load airport metadata from earth_aptmeta.dat (no caching - smaller file)
 */
export async function loadAirportMetadata(
  xplanePath: string
): Promise<NavLoadResult<Map<string, AirportMetadata>>> {
  const aptMetaPath = getAptMetaDataPath(xplanePath);

  if (!fs.existsSync(aptMetaPath)) {
    logger.data.debug(`earth_aptmeta.dat not found: ${aptMetaPath}`);
    return { data: new Map(), count: 0, loaded: false, source: null, fromCache: false };
  }

  try {
    const content = await fs.promises.readFile(aptMetaPath, 'utf-8');
    const { data, errors, stats } = parseAirportMetadata(content);
    warnSkipped('Airport metadata', { errors, stats });
    logger.data.info(`Loaded ${stats.parsed} airport metadata entries in ${stats.timeMs}ms`);
    return { data, count: data.size, loaded: true, source: aptMetaPath, fromCache: false };
  } catch (error) {
    logger.data.warn('Failed to load airport metadata:', error);
    return { data: new Map(), count: 0, loaded: false, source: null, fromCache: false };
  }
}
