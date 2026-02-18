/**
 * Navigation Data Loader
 * Handles loading of navigation data files (navaids, waypoints, airspaces, airways, etc.)
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

export interface NavLoadResult<T> {
  data: T;
  loaded: boolean;
  source: string | null;
}

/**
 * Load navaids from earth_nav.dat
 */
export async function loadNavaids(xplanePath: string): Promise<NavLoadResult<Navaid[]>> {
  const navPath = getNavDataPath(xplanePath);

  if (!fs.existsSync(navPath)) {
    logger.data.warn(`earth_nav.dat not found: ${navPath}`);
    return { data: [], loaded: false, source: null };
  }

  const content = await fs.promises.readFile(navPath, 'utf-8');
  const { data, errors, stats } = parseNavaids(content);
  if (errors.length > 0) {
    logger.data.warn(`Navaids: ${errors.length} errors, ${stats.skipped} skipped`);
  }
  logger.data.info(`Loaded ${stats.parsed} navaids in ${stats.timeMs}ms`);
  return { data, loaded: true, source: navPath };
}

/**
 * Load waypoints from earth_fix.dat
 */
export async function loadWaypoints(xplanePath: string): Promise<NavLoadResult<Waypoint[]>> {
  const fixPath = getFixDataPath(xplanePath);

  if (!fs.existsSync(fixPath)) {
    logger.data.warn(`earth_fix.dat not found: ${fixPath}`);
    return { data: [], loaded: false, source: null };
  }

  const content = await fs.promises.readFile(fixPath, 'utf-8');
  const { data, errors, stats } = parseWaypoints(content);
  if (errors.length > 0) {
    logger.data.warn(`Waypoints: ${errors.length} errors, ${stats.skipped} skipped`);
  }
  logger.data.info(`Loaded ${stats.parsed} waypoints in ${stats.timeMs}ms`);
  return { data, loaded: true, source: fixPath };
}

/**
 * Load airspaces from airspace.txt
 */
export async function loadAirspaces(xplanePath: string): Promise<NavLoadResult<Airspace[]>> {
  const airspacePath = getAirspaceDataPath(xplanePath);

  if (!fs.existsSync(airspacePath)) {
    logger.data.warn(`airspace.txt not found: ${airspacePath}`);
    return { data: [], loaded: false, source: null };
  }

  const content = await fs.promises.readFile(airspacePath, 'utf-8');
  const { data, errors, stats } = parseAirspaces(content);
  if (errors.length > 0) {
    logger.data.warn(`Airspaces: ${errors.length} errors, ${stats.skipped} skipped`);
  }
  logger.data.info(`Loaded ${stats.parsed} airspaces in ${stats.timeMs}ms`);
  return { data, loaded: true, source: airspacePath };
}

/**
 * Load airways from earth_awy.dat
 */
export async function loadAirways(xplanePath: string): Promise<NavLoadResult<AirwaySegment[]>> {
  const awyPath = getAirwayDataPath(xplanePath);

  if (!fs.existsSync(awyPath)) {
    logger.data.warn(`earth_awy.dat not found: ${awyPath}`);
    return { data: [], loaded: false, source: null };
  }

  const content = await fs.promises.readFile(awyPath, 'utf-8');
  const { data, errors, stats } = parseAirways(content);
  if (errors.length > 0) {
    logger.data.warn(`Airways: ${errors.length} errors, ${stats.skipped} skipped`);
  }
  logger.data.info(`Loaded ${stats.parsed} airway segments in ${stats.timeMs}ms`);
  return { data, loaded: true, source: awyPath };
}

/**
 * Load ATC data from Navigraph atc.dat
 */
export async function loadATCData(xplanePath: string): Promise<NavLoadResult<ATCController[]>> {
  const atcPath = getAtcDataPath(xplanePath);

  if (!atcPath) {
    logger.data.debug('ATC data file not found (Navigraph-only feature)');
    return { data: [], loaded: false, source: null };
  }

  try {
    const content = await fs.promises.readFile(atcPath, 'utf-8');
    const { data, errors, stats } = parseATCData(content);
    if (errors.length > 0) {
      logger.data.warn(`ATC: ${errors.length} errors, ${stats.skipped} skipped`);
    }
    logger.data.info(`Loaded ${stats.parsed} ATC controllers in ${stats.timeMs}ms`);
    return { data, loaded: true, source: atcPath };
  } catch (error) {
    logger.data.warn('Failed to load ATC data:', error);
    return { data: [], loaded: false, source: null };
  }
}

/**
 * Load holding patterns from earth_hold.dat
 */
export async function loadHoldingPatterns(
  xplanePath: string
): Promise<NavLoadResult<HoldingPattern[]>> {
  const holdPath = getHoldDataPath(xplanePath);

  if (!fs.existsSync(holdPath)) {
    logger.data.debug(`earth_hold.dat not found: ${holdPath}`);
    return { data: [], loaded: false, source: null };
  }

  try {
    const content = await fs.promises.readFile(holdPath, 'utf-8');
    const { data, errors, stats } = parseHoldingPatterns(content);
    if (errors.length > 0) {
      logger.data.warn(`Holdings: ${errors.length} errors, ${stats.skipped} skipped`);
    }
    logger.data.info(`Loaded ${stats.parsed} holding patterns in ${stats.timeMs}ms`);
    return { data, loaded: true, source: holdPath };
  } catch (error) {
    logger.data.warn('Failed to load holding patterns:', error);
    return { data: [], loaded: false, source: null };
  }
}

/**
 * Load airport metadata from earth_aptmeta.dat
 */
export async function loadAirportMetadata(
  xplanePath: string
): Promise<NavLoadResult<Map<string, AirportMetadata>>> {
  const aptMetaPath = getAptMetaDataPath(xplanePath);

  if (!fs.existsSync(aptMetaPath)) {
    logger.data.debug(`earth_aptmeta.dat not found: ${aptMetaPath}`);
    return { data: new Map(), loaded: false, source: null };
  }

  try {
    const content = await fs.promises.readFile(aptMetaPath, 'utf-8');
    const { data, errors, stats } = parseAirportMetadata(content);
    if (errors.length > 0) {
      logger.data.warn(`Airport metadata: ${errors.length} errors, ${stats.skipped} skipped`);
    }
    logger.data.info(`Loaded ${stats.parsed} airport metadata entries in ${stats.timeMs}ms`);
    return { data, loaded: true, source: aptMetaPath };
  } catch (error) {
    logger.data.warn('Failed to load airport metadata:', error);
    return { data: new Map(), loaded: false, source: null };
  }
}
