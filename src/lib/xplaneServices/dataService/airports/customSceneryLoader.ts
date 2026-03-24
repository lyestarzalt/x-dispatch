/**
 * Custom Scenery Loader
 * Scans and loads airports from Custom Scenery apt.dat files.
 * Custom Scenery airports override Global Airports with the same ICAO code.
 *
 * Location: X-Plane 12/Custom Scenery/{pack}/Earth nav data/apt.dat
 */
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { AirportProgressCallback, AptFileInfo, ParsedAirportEntry } from '../types';
import { getFileMtime } from './airportCache';
import { scanAptFile } from './airportScanner';

export interface CustomSceneryLoadResult {
  airports: Map<string, ParsedAirportEntry>;
  fileInfos: AptFileInfo[];
  airportCounts: Map<string, number>;
  stats: {
    totalPacks: number;
    totalAirports: number;
    validAirports: number;
    errors: number;
  };
}

/**
 * Find all Custom Scenery apt.dat files
 */
export function findCustomSceneryAptFiles(xplanePath: string): string[] {
  const customSceneryPath = path.join(xplanePath, 'Custom Scenery');
  const aptFiles: string[] = [];

  if (!fs.existsSync(customSceneryPath)) {
    return aptFiles;
  }

  try {
    const entries = fs.readdirSync(customSceneryPath, { withFileTypes: true });
    for (const entry of entries) {
      try {
        // Follow symlinks — some users symlink scenery packs from other drives
        const isDir =
          entry.isDirectory() ||
          (entry.isSymbolicLink() &&
            fs.statSync(path.join(customSceneryPath, entry.name)).isDirectory());
        if (isDir) {
          const aptPath = path.join(customSceneryPath, entry.name, 'Earth nav data', 'apt.dat');
          if (fs.existsSync(aptPath)) {
            aptFiles.push(aptPath);
          }
        }
      } catch {
        // Skip this entry (broken symlink, unmounted drive, etc.) but continue scanning
        logger.data.warn(
          `Skipping Custom Scenery entry "${entry.name}" (unreadable or broken symlink)`
        );
      }
    }
  } catch (err) {
    logger.data.warn('Error scanning Custom Scenery:', err);
  }

  return aptFiles;
}

/**
 * Get file info for all Custom Scenery apt.dat files
 */
export function getCustomSceneryFileInfos(xplanePath: string): AptFileInfo[] {
  const aptFiles = findCustomSceneryAptFiles(xplanePath);
  const fileInfos: AptFileInfo[] = [];

  for (const aptPath of aptFiles) {
    const mtime = getFileMtime(aptPath);
    if (mtime !== null) {
      fileInfos.push({ path: aptPath, mtime });
    }
  }

  return fileInfos;
}

/**
 * Load airports from all Custom Scenery apt.dat files
 * Returns airports that will override Global Airports
 */
export async function loadCustomSceneryAirports(
  xplanePath: string,
  onProgress?: AirportProgressCallback
): Promise<CustomSceneryLoadResult> {
  const aptFiles = findCustomSceneryAptFiles(xplanePath);

  if (aptFiles.length === 0) {
    logger.data.debug('No Custom Scenery apt.dat files found');
    return {
      airports: new Map(),
      fileInfos: [],
      airportCounts: new Map(),
      stats: { totalPacks: 0, totalAirports: 0, validAirports: 0, errors: 0 },
    };
  }

  // Extract pack names from paths for logging
  const packNames = aptFiles.map((f) => path.basename(path.dirname(path.dirname(f))));
  logger.data.info(
    `Found ${aptFiles.length} Custom Scenery packs with apt.dat: ${packNames.slice(0, 10).join(', ')}${packNames.length > 10 ? ` (+${packNames.length - 10} more)` : ''}`
  );

  const airports = new Map<string, ParsedAirportEntry>();
  const fileInfos: AptFileInfo[] = [];
  const airportCounts = new Map<string, number>();
  let totalAirports = 0;
  let validAirports = 0;
  let totalErrors = 0;

  for (let i = 0; i < aptFiles.length; i++) {
    const aptFile = aptFiles[i];
    const packName = path.basename(path.dirname(path.dirname(aptFile)));
    onProgress?.({ phase: 'custom', packIndex: i, packCount: aptFiles.length, packName });

    const result = await scanAptFile(aptFile);

    // Track file info
    const mtime = getFileMtime(aptFile);
    if (mtime !== null) {
      fileInfos.push({ path: aptFile, mtime });
    }

    // Track airport count per file
    airportCounts.set(aptFile, result.airports.size);

    // Merge airports (later files override earlier ones)
    for (const [icao, airport] of result.airports) {
      airports.set(icao, airport);
    }

    totalAirports += result.stats.total;
    validAirports += result.stats.valid;
    totalErrors += result.errors.length;

    // Log pack-specific errors if any
    if (result.errors.length > 0) {
      const packName = path.basename(path.dirname(path.dirname(aptFile)));
      logger.data.warn(`Custom Scenery "${packName}": ${result.errors.length} validation errors`);
    }
  }

  logger.data.info(`Loaded ${validAirports} airports from ${aptFiles.length} Custom Scenery packs`);

  return {
    airports,
    fileInfos,
    airportCounts,
    stats: {
      totalPacks: aptFiles.length,
      totalAirports,
      validAirports,
      errors: totalErrors,
    },
  };
}
