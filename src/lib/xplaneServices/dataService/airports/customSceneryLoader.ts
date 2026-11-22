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
import { resolveLnk } from '@/lib/utils/resolveLnk';
import type { AirportProgressCallback, AptFileInfo, ParsedAirportEntry } from '../types';
import { readFileMtime } from './airportCache';
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
 * Find all Custom Scenery apt.dat files.
 *
 * Runs on every start before the cache check, over folders that can hold
 * thousands of packs on a slow or network drive, so every filesystem call is
 * async: the main process stays free while the stats queue on libuv's pool.
 */
export async function findCustomSceneryAptFiles(xplanePath: string): Promise<string[]> {
  const customSceneryPath = path.join(xplanePath, 'Custom Scenery');

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(customSceneryPath, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.data.warn('Error scanning Custom Scenery:', err);
    }
    return [];
  }

  const skipped: SkippedEntry[] = [];
  const found = await Promise.all(
    entries.map((entry) => aptFileOf(customSceneryPath, entry, skipped))
  );
  const aptFiles = found.filter((aptPath): aptPath is string => aptPath !== null);
  const summary = skippedSummary(skipped);
  if (summary) logger.data.warn(summary);

  // Dedup by canonical path. A .lnk shortcut whose target resolves to a
  // sibling directory (or another .lnk's target) would otherwise emit the
  // same physical apt.dat twice — once via the dir scan, once via the
  // shortcut. `path.resolve` normalizes separators/case so different
  // string spellings of the same path collapse. Without this, downstream
  // parsing scans the same file twice and the `apt_file_meta` insert
  // blows up on the path PRIMARY KEY.
  return [...new Set(aptFiles.map((p) => path.resolve(p)))];
}

interface SkippedEntry {
  name: string;
  /** `parse-error: <the parser's text>` for a shortcut, `unreadable` for a folder or link. */
  why: string;
}

/**
 * One line for every entry a scan could not follow. A pack per line filled the
 * log on installs with dozens of shortcuts, on every launch; the names stay in
 * the local log at info.
 */
export function skippedSummary(skipped: SkippedEntry[]): string | null {
  if (skipped.length === 0) return null;
  const counts = new Map<string, number>();
  for (const { why } of skipped) counts.set(why, (counts.get(why) ?? 0) + 1);
  const parts = [...counts].map(([why, count]) => `${count} ${why}`);
  return `Custom Scenery: ${skipped.length} entries skipped (${parts.join(', ')})`;
}

/** The apt.dat a Custom Scenery entry leads to, or null when it has none. */
async function aptFileOf(
  customSceneryPath: string,
  entry: fs.Dirent,
  skipped: SkippedEntry[]
): Promise<string | null> {
  const entryPath = path.join(customSceneryPath, entry.name);
  try {
    // Real directory or junction/symlink
    const isDir =
      entry.isDirectory() ||
      (entry.isSymbolicLink() && (await fs.promises.stat(entryPath)).isDirectory());
    if (isDir) return aptFileIn(entryPath);

    // Windows shell shortcut (.lnk): resolve target and look for apt.dat
    // inside the linked directory.
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.lnk')) {
      const resolved = await resolveLnk(entryPath);
      if (!resolved.ok) {
        const why = resolved.error
          ? `shortcut ${resolved.reason}: ${resolved.error}`
          : `shortcut ${resolved.reason}`;
        logger.data.info(`Skipping shortcut "${entry.name}" (${why})`);
        skipped.push({ name: entry.name, why });
        return null;
      }
      try {
        if (!(await fs.promises.stat(resolved.targetPath)).isDirectory()) return null;
      } catch {
        return null;
      }
      return aptFileIn(resolved.targetPath);
    }
    return null;
  } catch {
    // Skip this entry (broken symlink, unmounted drive, etc.) but continue scanning
    logger.data.info(
      `Skipping Custom Scenery entry "${entry.name}" (unreadable or broken symlink)`
    );
    skipped.push({ name: entry.name, why: 'unreadable or broken link' });
    return null;
  }
}

async function aptFileIn(packPath: string): Promise<string | null> {
  const aptPath = path.join(packPath, 'Earth nav data', 'apt.dat');
  try {
    await fs.promises.access(aptPath);
    return aptPath;
  } catch {
    return null;
  }
}

/**
 * Get file info for all Custom Scenery apt.dat files
 */
export async function getCustomSceneryFileInfos(xplanePath: string): Promise<AptFileInfo[]> {
  const aptFiles = await findCustomSceneryAptFiles(xplanePath);
  const infos = await Promise.all(
    aptFiles.map(async (aptPath) => {
      const mtime = await readFileMtime(aptPath);
      return mtime === null ? null : { path: aptPath, mtime };
    })
  );
  return infos.filter((info): info is AptFileInfo => info !== null);
}

/**
 * Load airports from all Custom Scenery apt.dat files
 * Returns airports that will override Global Airports
 */
export async function loadCustomSceneryAirports(
  xplanePath: string,
  onProgress?: AirportProgressCallback
): Promise<CustomSceneryLoadResult> {
  const aptFiles = await findCustomSceneryAptFiles(xplanePath);

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
    if (!aptFile) continue;
    const packName = path.basename(path.dirname(path.dirname(aptFile)));
    onProgress?.({ phase: 'custom', packIndex: i, packCount: aptFiles.length, packName });

    const result = await scanAptFile(aptFile);

    // Track file info
    const mtime = await readFileMtime(aptFile);
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
