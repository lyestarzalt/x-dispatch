/**
 * Global Airports Loader
 * Loads airports from the main X-Plane Global Airports apt.dat file.
 * This is the base layer that Custom Scenery can override.
 *
 * Location: X-Plane 12/Global Scenery/Global Airports/Earth nav data/apt.dat
 */
import * as fs from 'fs';
import logger from '@/lib/utils/logger';
import { getAptDataPath } from '../paths';
import type { AptFileInfo, ParsedAirportEntry } from '../types';
import { getFileMtime } from './airportCache';
import { scanAptFile } from './airportScanner';

export interface GlobalAptLoadResult {
  airports: Map<string, ParsedAirportEntry>;
  fileInfo: AptFileInfo | null;
  stats: {
    total: number;
    valid: number;
    errors: number;
  };
}

/**
 * Get the Global Airports apt.dat file info
 */
export function getGlobalAptFileInfo(xplanePath: string): AptFileInfo | null {
  const globalPath = getAptDataPath(xplanePath);
  const mtime = getFileMtime(globalPath);

  if (mtime === null) {
    return null;
  }

  return { path: globalPath, mtime };
}

/**
 * Load airports from Global Airports apt.dat
 */
export async function loadGlobalAirports(xplanePath: string): Promise<GlobalAptLoadResult> {
  const globalPath = getAptDataPath(xplanePath);

  if (!fs.existsSync(globalPath)) {
    logger.data.warn(`Global apt.dat not found: ${globalPath}`);
    return {
      airports: new Map(),
      fileInfo: null,
      stats: { total: 0, valid: 0, errors: 0 },
    };
  }

  logger.data.info(`Loading Global Airports from: ${globalPath}`);

  const startTime = Date.now();
  const result = await scanAptFile(globalPath);
  const elapsed = Date.now() - startTime;

  logger.data.info(
    `Loaded ${result.stats.valid} airports from Global Airports in ${elapsed}ms ` +
      `(${result.stats.invalid} invalid)`
  );

  if (result.errors.length > 0 && result.errors.length <= 10) {
    for (const err of result.errors) {
      logger.data.warn(`Global apt.dat: ${err.message}`);
    }
  } else if (result.errors.length > 10) {
    logger.data.warn(`Global apt.dat: ${result.errors.length} validation errors (showing first 5)`);
    for (const err of result.errors.slice(0, 5)) {
      logger.data.warn(`  ${err.message}`);
    }
  }

  const fileInfo = getGlobalAptFileInfo(xplanePath);

  return {
    airports: result.airports,
    fileInfo,
    stats: {
      total: result.stats.total,
      valid: result.stats.valid,
      errors: result.errors.length,
    },
  };
}
