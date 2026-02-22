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
} from '../paths';
import {
  checkNavCacheValidity,
  clearAirspaces,
  clearAirways,
  clearNavaids,
  clearWaypoints,
  detectSourceType,
  getAirspaceCount,
  getAirwayCount,
  getAllAirspacesFromDb,
  getAllAirwaysFromDb,
  getAllNavaidsFromDb,
  getAllWaypointsFromDb,
  getNavaidCount,
  getWaypointCount,
  insertAirspaces,
  insertAirways,
  insertNavaids,
  insertWaypoints,
  persistNavDatabase,
  updateNavFileMeta,
} from './navCache';

// ============================================================================
// Types
// ============================================================================

export interface NavLoadResult<T> {
  data: T;
  loaded: boolean;
  source: string | null;
  fromCache: boolean;
}

// ============================================================================
// Navaids Loading
// ============================================================================

/**
 * Load navaids from earth_nav.dat with caching
 */
export async function loadNavaids(xplanePath: string): Promise<NavLoadResult<Navaid[]>> {
  const navPath = getNavDataPath(xplanePath);

  if (!fs.existsSync(navPath)) {
    logger.data.warn(`earth_nav.dat not found: ${navPath}`);
    return { data: [], loaded: false, source: null, fromCache: false };
  }

  // Check cache validity
  const cacheCheck = checkNavCacheValidity(navPath, 'navaids');
  const sourceType = detectSourceType(navPath);

  if (!cacheCheck.needsReload) {
    const count = getNavaidCount();
    logger.data.info(`Navaids cache valid (${sourceType}), loaded ${count} from database`);
    return {
      data: getAllNavaidsFromDb(),
      loaded: true,
      source: navPath,
      fromCache: true,
    };
  }

  logger.data.info(`Navaids cache stale (${cacheCheck.reason}), reloading from ${sourceType}`);

  // Parse file
  const startTime = Date.now();
  const content = await fs.promises.readFile(navPath, 'utf-8');
  const { data, errors, stats } = parseNavaids(content);

  if (errors.length > 0) {
    logger.data.warn(`Navaids: ${errors.length} errors, ${stats.skipped} skipped`);
  }

  // Store in database
  const insertStart = Date.now();
  clearNavaids();
  insertNavaids(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(navPath, 'navaids', data.length);
  persistNavDatabase();

  const elapsed = Date.now() - startTime;
  logger.data.info(`Loaded ${stats.parsed} navaids in ${elapsed}ms (insert: ${insertTime}ms)`);

  return { data, loaded: true, source: navPath, fromCache: false };
}

// ============================================================================
// Waypoints Loading
// ============================================================================

/**
 * Load waypoints from earth_fix.dat with caching
 */
export async function loadWaypoints(xplanePath: string): Promise<NavLoadResult<Waypoint[]>> {
  const fixPath = getFixDataPath(xplanePath);

  if (!fs.existsSync(fixPath)) {
    logger.data.warn(`earth_fix.dat not found: ${fixPath}`);
    return { data: [], loaded: false, source: null, fromCache: false };
  }

  // Check cache validity
  const cacheCheck = checkNavCacheValidity(fixPath, 'waypoints');
  const sourceType = detectSourceType(fixPath);

  if (!cacheCheck.needsReload) {
    const count = getWaypointCount();
    logger.data.info(`Waypoints cache valid (${sourceType}), loaded ${count} from database`);
    return {
      data: getAllWaypointsFromDb(),
      loaded: true,
      source: fixPath,
      fromCache: true,
    };
  }

  logger.data.info(`Waypoints cache stale (${cacheCheck.reason}), reloading from ${sourceType}`);

  // Parse file
  const startTime = Date.now();
  const content = await fs.promises.readFile(fixPath, 'utf-8');
  const { data, errors, stats } = parseWaypoints(content);

  if (errors.length > 0) {
    logger.data.warn(`Waypoints: ${errors.length} errors, ${stats.skipped} skipped`);
  }

  // Store in database
  const insertStart = Date.now();
  clearWaypoints();
  insertWaypoints(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(fixPath, 'waypoints', data.length);
  persistNavDatabase();

  const elapsed = Date.now() - startTime;
  logger.data.info(`Loaded ${stats.parsed} waypoints in ${elapsed}ms (insert: ${insertTime}ms)`);

  return { data, loaded: true, source: fixPath, fromCache: false };
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
    return { data: [], loaded: false, source: null, fromCache: false };
  }

  // Check cache validity
  const cacheCheck = checkNavCacheValidity(awyPath, 'airways');
  const sourceType = detectSourceType(awyPath);

  if (!cacheCheck.needsReload) {
    const count = getAirwayCount();
    logger.data.info(`Airways cache valid (${sourceType}), loaded ${count} from database`);
    return {
      data: getAllAirwaysFromDb(),
      loaded: true,
      source: awyPath,
      fromCache: true,
    };
  }

  logger.data.info(`Airways cache stale (${cacheCheck.reason}), reloading from ${sourceType}`);

  // Parse file
  const startTime = Date.now();
  const content = await fs.promises.readFile(awyPath, 'utf-8');
  const { data, errors, stats } = parseAirways(content);

  if (errors.length > 0) {
    logger.data.warn(`Airways: ${errors.length} errors, ${stats.skipped} skipped`);
  }

  // Store in database
  const insertStart = Date.now();
  clearAirways();
  insertAirways(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(awyPath, 'airways', data.length);
  persistNavDatabase();

  const elapsed = Date.now() - startTime;
  logger.data.info(
    `Loaded ${stats.parsed} airway segments in ${elapsed}ms (insert: ${insertTime}ms)`
  );

  return { data, loaded: true, source: awyPath, fromCache: false };
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
    return { data: [], loaded: false, source: null, fromCache: false };
  }

  // Check cache validity
  const cacheCheck = checkNavCacheValidity(airspacePath, 'airspaces');
  const sourceType = detectSourceType(airspacePath);

  if (!cacheCheck.needsReload) {
    const count = getAirspaceCount();
    // Safety check: if cache says valid but table is empty, force reload
    if (count > 0) {
      logger.data.info(`Airspaces cache valid (${sourceType}), loaded ${count} from database`);
      return {
        data: getAllAirspacesFromDb(),
        loaded: true,
        source: airspacePath,
        fromCache: true,
      };
    }
    logger.data.warn(`Airspaces cache metadata valid but table empty, forcing reload`);
  }

  logger.data.info(`Airspaces cache stale (${cacheCheck.reason}), reloading from ${sourceType}`);

  // Parse file
  const startTime = Date.now();
  const content = await fs.promises.readFile(airspacePath, 'utf-8');
  const { data, errors, stats } = parseAirspaces(content);

  if (errors.length > 0) {
    logger.data.warn(`Airspaces: ${errors.length} errors, ${stats.skipped} skipped`);
  }

  // Store in database
  const insertStart = Date.now();
  clearAirspaces();
  insertAirspaces(data);
  const insertTime = Date.now() - insertStart;

  // Update file metadata
  updateNavFileMeta(airspacePath, 'airspaces', data.length);
  persistNavDatabase();

  const elapsed = Date.now() - startTime;
  logger.data.info(`Loaded ${stats.parsed} airspaces in ${elapsed}ms (insert: ${insertTime}ms)`);

  return { data, loaded: true, source: airspacePath, fromCache: false };
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
    return { data: [], loaded: false, source: null, fromCache: false };
  }

  try {
    const content = await fs.promises.readFile(atcPath, 'utf-8');
    const { data, errors, stats } = parseATCData(content);
    if (errors.length > 0) {
      logger.data.warn(`ATC: ${errors.length} errors, ${stats.skipped} skipped`);
    }
    logger.data.info(`Loaded ${stats.parsed} ATC controllers in ${stats.timeMs}ms`);
    return { data, loaded: true, source: atcPath, fromCache: false };
  } catch (error) {
    logger.data.warn('Failed to load ATC data:', error);
    return { data: [], loaded: false, source: null, fromCache: false };
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
    return { data: [], loaded: false, source: null, fromCache: false };
  }

  try {
    const content = await fs.promises.readFile(holdPath, 'utf-8');
    const { data, errors, stats } = parseHoldingPatterns(content);
    if (errors.length > 0) {
      logger.data.warn(`Holdings: ${errors.length} errors, ${stats.skipped} skipped`);
    }
    logger.data.info(`Loaded ${stats.parsed} holding patterns in ${stats.timeMs}ms`);
    return { data, loaded: true, source: holdPath, fromCache: false };
  } catch (error) {
    logger.data.warn('Failed to load holding patterns:', error);
    return { data: [], loaded: false, source: null, fromCache: false };
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
    return { data: new Map(), loaded: false, source: null, fromCache: false };
  }

  try {
    const content = await fs.promises.readFile(aptMetaPath, 'utf-8');
    const { data, errors, stats } = parseAirportMetadata(content);
    if (errors.length > 0) {
      logger.data.warn(`Airport metadata: ${errors.length} errors, ${stats.skipped} skipped`);
    }
    logger.data.info(`Loaded ${stats.parsed} airport metadata entries in ${stats.timeMs}ms`);
    return { data, loaded: true, source: aptMetaPath, fromCache: false };
  } catch (error) {
    logger.data.warn('Failed to load airport metadata:', error);
    return { data: new Map(), loaded: false, source: null, fromCache: false };
  }
}
