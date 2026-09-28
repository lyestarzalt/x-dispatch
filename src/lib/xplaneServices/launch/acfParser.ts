import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { Aircraft, Livery } from '@/types/aircraft';

/** Parallel .acf reads; the files are large, so a small pool overlaps disk
 * I/O without holding many multi-MB strings in memory at once. */
const PARSE_CONCURRENCY = 4;

async function isDirEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return (await fs.promises.stat(path.join(parentPath, entry.name))).isDirectory();
    } catch {
      return false;
    }
  }
  return false;
}

async function isFileEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
  if (entry.isFile()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return (await fs.promises.stat(path.join(parentPath, entry.name))).isFile();
    } catch {
      return false;
    }
  }
  return false;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.promises.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Safely read a numeric property, returning 0 if missing or NaN */
function numProp(props: Record<string, string>, key: string): number {
  const v = props[key];
  if (v === undefined) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/** Safely read an integer property, returning 0 if missing or NaN */
function intProp(props: Record<string, string>, key: string): number {
  const v = props[key];
  if (v === undefined) return 0;
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

/** Safely read a string property, returning fallback if missing */
function strProp(props: Record<string, string>, key: string, fallback: string): string {
  return props[key] ?? fallback;
}

/** Accepts "4.05.35", "v1.2", "4.05rc1"; rejects prose and oversized strings. */
const VERSION_PATTERN = /^v?\d+(\.\d+)*[a-z0-9.-]{0,10}$/i;

/**
 * Version from a version*.txt next to the .acf; add-on updaters write either
 * version.txt or a per-model file like version-777.txt. The .acf's own
 * acf/_version is coarser or free text and stock aircraft omit it entirely,
 * so a file wins when both exist.
 */
async function readVersionFile(acfDir: string): Promise<string | null> {
  let candidates: string[];
  try {
    const entries = await fs.promises.readdir(acfDir);
    candidates = entries
      .filter((name) => /^version[a-z0-9 _-]*\.txt$/i.test(name))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));
  } catch {
    return null;
  }

  for (const name of candidates) {
    try {
      const filePath = path.join(acfDir, name);
      const stat = await fs.promises.stat(filePath);
      if (stat.size === 0 || stat.size > 256) continue;
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const firstLine = (content.split('\n', 1)[0] ?? '').trim();
      if (VERSION_PATTERN.test(firstLine)) return firstLine;
    } catch {
      // Try the next candidate
    }
  }
  return null;
}

function versionFromAcf(props: Record<string, string>): string {
  const raw = (props['acf/_version'] ?? '').replace(/^ver(sion)?\.?\s*/i, '').trim();
  return VERSION_PATTERN.test(raw) ? raw : '';
}

async function parseAcfFile(acfPath: string, xplanePath: string): Promise<Aircraft | null> {
  try {
    const content = await fs.promises.readFile(acfPath, 'utf-8');
    const props: Record<string, string> = {};

    // Walk the file line by line without materializing a lines array — .acf
    // files run to several MB and only the `P acf/`/`P _cgpt/` lines matter.
    let lineStart = 0;
    while (lineStart < content.length) {
      let lineEnd = content.indexOf('\n', lineStart);
      if (lineEnd === -1) lineEnd = content.length;
      if (content.startsWith('P acf/', lineStart) || content.startsWith('P _cgpt/', lineStart)) {
        const line = content.slice(lineStart, lineEnd).trimEnd(); // Handle CRLF line endings
        const match = line.match(/^P ([^\s]+)\s+(.*)$/);
        if (match) {
          const key = match[1];
          const value = match[2];
          if (key && value !== undefined) {
            props[key] = value;
          }
        }
      }
      lineStart = lineEnd + 1;
    }

    // Get relative path from X-Plane root
    const relativePath = path.relative(xplanePath, acfPath).replace(/\\/g, '/');

    const acfDir = path.dirname(acfPath);
    const acfBasename = path.basename(acfPath, '.acf');
    const previewImage = await findPreviewImage(acfDir, acfBasename);
    const thumbnailImage = await findThumbnailImage(acfDir, acfBasename);

    // Find liveries
    const liveries = await scanLiveries(acfDir);

    // Parse fuel tank names and ratios
    //
    // Laminar aircraft (R22, S-76, Cessna, etc.) use the standard properties:
    //   acf/_tank_name/0..8  — human-readable tank names ("Main", "Aux")
    //   acf/_tank_rat/0..8   — fraction of _m_fuel_max_tot per tank (sum ≈ 1.0)
    //
    // Third-party aircraft (XFER H145, Mirage-V, etc.) often omit _tank_name.
    // In that case we use two fallback strategies:
    //
    // Fallback A — _tank_rat as source of truth for tank count:
    //   _tank_rat tells X-Plane how many real pilot-visible tanks exist.
    //   e.g. H145 has _tank_rat/0=1.0 (one tank, 100% of fuel) even though
    //   _cgpt has two 804lb entries for internal CG distribution. X-Plane's
    //   own UI shows 1 tank at 723kg — _tank_rat is correct, _cgpt is not.
    //   We pair non-zero _tank_rat entries with _cgpt names for display.
    //
    // Fallback B — _cgpt w_max (last resort):
    //   If _tank_rat is entirely zero (unlikely but defensive), derive tank
    //   structure from _cgpt entries with non-zero _w_max.
    const tankNames: string[] = [];
    const tankRatios: number[] = [];
    const tankIndices: number[] = [];
    const maxFuelTotal = numProp(props, 'acf/_m_fuel_max_tot');

    // Primary path: acf/_tank_name properties (works for all Laminar aircraft)
    for (let i = 0; i < 9; i++) {
      const tankName = props[`acf/_tank_name/${i}`];
      if (tankName) {
        tankNames.push(tankName);
        tankRatios.push(numProp(props, `acf/_tank_rat/${i}`));
        tankIndices.push(i);
      }
    }

    // Fallback when acf/_tank_name is missing (third-party aircraft)
    if (tankNames.length === 0 && maxFuelTotal > 0) {
      // Fallback A: use non-zero _tank_rat entries — these are the real tanks
      // that X-Plane exposes to the pilot (e.g. H145: 1 tank at ratio 1.0)
      // Preserve the original X-Plane slot index so fuel is placed correctly
      // (e.g. Sea King uses slot 1, not 0).
      for (let i = 0; i < 9; i++) {
        const ratio = numProp(props, `acf/_tank_rat/${i}`);
        if (ratio > 0) {
          const cgptIdx = i + 1;
          const cgptName = strProp(props, `_cgpt/${cgptIdx}/_name`, `Tank ${i + 1}`);
          tankNames.push(cgptName);
          tankRatios.push(ratio);
          tankIndices.push(i);
        }
      }

      // Fallback B: if _tank_rat is all zeros, derive from _cgpt capacity
      if (tankNames.length === 0) {
        for (let i = 0; i < 9; i++) {
          const cgptIdx = i + 1;
          const cgptName = props[`_cgpt/${cgptIdx}/_name`];
          const maxWeight = numProp(props, `_cgpt/${cgptIdx}/_w_max`);
          if (cgptName && maxWeight > 0) {
            tankNames.push(cgptName);
            tankRatios.push(maxWeight / maxFuelTotal);
            tankIndices.push(i);
          }
        }
      }
    }

    // Parse payload stations (up to 9)
    // Laminar aircraft define named stations (Pilot, Copilot, Baggage, etc.)
    // Third-party aircraft (XFER H145) often omit these entirely.
    const payloadStations: { name: string; maxWeight: number }[] = [];
    for (let i = 0; i < 9; i++) {
      const name = props[`acf/_fixed_name/${i}`];
      const maxWeight = numProp(props, `acf/_fixed_max/${i}`);
      if (name && maxWeight > 0) {
        payloadStations.push({ name, maxWeight });
      }
    }
    // Fallback: synthesize a single "Payload" station from available weight
    // budget, same as X-Plane's own UI which shows a generic payload slider
    // when no named stations exist.
    if (payloadStations.length === 0) {
      const emptyLbs = numProp(props, 'acf/_m_empty');
      const maxLbs = numProp(props, 'acf/_m_max');
      const availablePayload = maxLbs - emptyLbs - maxFuelTotal;
      if (availablePayload > 0) {
        payloadStations.push({ name: 'Payload', maxWeight: availablePayload });
      }
    }

    return {
      path: relativePath,
      name: strProp(props, 'acf/_name', path.basename(acfPath, '.acf')),
      icao: strProp(props, 'acf/_ICAO', ''),
      description: strProp(props, 'acf/_descrip', ''),
      manufacturer: strProp(props, 'acf/_manufacturer', 'Unknown'),
      studio: strProp(props, 'acf/_studio', ''),
      author: strProp(props, 'acf/_author', ''),
      version: (await readVersionFile(acfDir)) ?? versionFromAcf(props),
      tailNumber: strProp(props, 'acf/_tailnum', ''),
      // Weights (lbs)
      emptyWeight: numProp(props, 'acf/_m_empty'),
      maxWeight: numProp(props, 'acf/_m_max'),
      maxFuel: numProp(props, 'acf/_m_fuel_max_tot'),
      tankNames,
      tankRatios,
      tankIndices,
      payloadStations,
      // Aircraft type
      isHelicopter: props['acf/_is_helicopter'] === '1',
      engineCount: intProp(props, 'acf/_num_engn'),
      propCount: intProp(props, 'acf/_num_prop'),
      // Speeds (knots)
      vneKts: numProp(props, 'acf/_Vne_kts'),
      vnoKts: numProp(props, 'acf/_Vno_kts'),
      previewImage,
      thumbnailImage,
      liveries,
    };
  } catch (err) {
    logger.launcher.debug(`Failed to parse: ${acfPath}`, err);
    return null;
  }
}

/**
 * Scan the Aircraft directory for all .acf files.
 * Async so a large hangar rescan never blocks the main process.
 */
export async function scanAircraftDirectory(xplanePath: string): Promise<Aircraft[]> {
  const startTime = Date.now();
  const aircraftDir = path.join(xplanePath, 'Aircraft');

  logger.launcher.info(`Scanning aircraft directory: ${aircraftDir}`);

  if (!(await fileExists(aircraftDir))) {
    logger.launcher.warn(`Aircraft directory not found: ${aircraftDir}`);
    return [];
  }

  // Recursively find all .acf files
  const acfFiles = await findAcfFiles(aircraftDir);
  logger.launcher.info(`Found ${acfFiles.length} .acf files`);

  const parsed = await mapWithConcurrency(acfFiles, PARSE_CONCURRENCY, (acfFile) =>
    parseAcfFile(acfFile, xplanePath)
  );
  const aircraft = parsed.filter((a): a is Aircraft => a !== null);
  const parseErrors = parsed.length - aircraft.length;

  // Sort by manufacturer, then by name
  aircraft.sort((a, b) => {
    const mfgCompare = a.manufacturer.localeCompare(b.manufacturer);
    if (mfgCompare !== 0) return mfgCompare;
    return a.name.localeCompare(b.name);
  });

  // Log summary stats
  const elapsed = Date.now() - startTime;
  const manufacturers = new Set(aircraft.map((a) => a.manufacturer)).size;
  const helicopters = aircraft.filter((a) => a.isHelicopter).length;
  const fixedWing = aircraft.length - helicopters;
  const withLiveries = aircraft.filter((a) => a.liveries.length > 1).length;
  const totalLiveries = aircraft.reduce((sum, a) => sum + a.liveries.length, 0);

  logger.launcher.info(
    `Aircraft scan complete in ${elapsed}ms: ${aircraft.length} aircraft (${fixedWing} fixed-wing, ${helicopters} helicopters), ${manufacturers} manufacturers, ${totalLiveries} liveries total`
  );
  if (parseErrors > 0) {
    logger.launcher.warn(`Failed to parse ${parseErrors} .acf files`);
  }
  if (withLiveries > 0) {
    logger.launcher.debug(`${withLiveries} aircraft have custom liveries`);
  }

  return aircraft;
}

/**
 * Recursively find all .acf files in a directory
 */
async function findAcfFiles(dir: string): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (await isDirEntry(entry, dir)) {
        // Skip hidden directories and common non-aircraft folders
        if (!entry.name.startsWith('.') && entry.name !== 'liveries') {
          results.push(...(await findAcfFiles(fullPath)));
        }
      } else if (
        (await isFileEntry(entry, dir)) &&
        entry.name.endsWith('.acf') &&
        !entry.name.endsWith('_AI.acf')
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip directories that can't be read
  }

  return results;
}

async function findPreviewImage(acfDir: string, acfBasename: string): Promise<string | null> {
  // Try common naming patterns
  const patterns = [
    `${acfBasename}_icon11.png`,
    `${acfBasename}_icon.png`,
    'icon11.png',
    'icon.png',
  ];

  for (const pattern of patterns) {
    const imagePath = path.join(acfDir, pattern);
    if (await fileExists(imagePath)) {
      return imagePath;
    }
  }

  return null;
}

async function findThumbnailImage(acfDir: string, acfBasename: string): Promise<string | null> {
  const patterns = [
    `${acfBasename}_icon11_thumb.png`,
    `${acfBasename}_thumb.png`,
    'icon11_thumb.png',
    'thumb.png',
  ];

  for (const pattern of patterns) {
    const imagePath = path.join(acfDir, pattern);
    if (await fileExists(imagePath)) {
      return imagePath;
    }
  }

  return null;
}

async function scanLiveries(acfDir: string): Promise<Livery[]> {
  const liveriesDir = path.join(acfDir, 'liveries');
  const liveries: Livery[] = [];

  // Add default livery first
  liveries.push({
    name: 'Default',
    displayName: 'Default',
    previewImage: null,
  });

  try {
    const entries = await fs.promises.readdir(liveriesDir, { withFileTypes: true });

    for (const entry of entries) {
      if ((await isDirEntry(entry, liveriesDir)) && !entry.name.startsWith('.')) {
        const liveryPath = path.join(liveriesDir, entry.name);
        const previewImage = await findLiveryPreview(liveryPath);

        liveries.push({
          name: entry.name,
          displayName: entry.name.replace(/_/g, ' '),
          previewImage,
        });
      }
    }
  } catch {
    // Skip liveries that can't be read (or none exist)
  }

  return liveries;
}

async function findLiveryPreview(liveryDir: string): Promise<string | null> {
  try {
    const entries = await fs.promises.readdir(liveryDir);

    // Look for icon11.png or similar
    for (const entry of entries) {
      if (entry.endsWith('_icon11.png') || entry === 'icon11.png') {
        return path.join(liveryDir, entry);
      }
    }

    // Fallback to any PNG
    for (const entry of entries) {
      if (entry.endsWith('.png') && !entry.includes('thumb')) {
        return path.join(liveryDir, entry);
      }
    }
  } catch {
    // Ignore errors
  }

  return null;
}

/**
 * Generate the aircraft key used in Freeflight.prf
 */
export function generateAircraftKey(aircraftPath: string): string {
  return (
    '_' +
    aircraftPath
      .replace(/\//g, '')
      .replace(/\./g, '')
      .replace(/-/g, '')
      .replace(/ /g, '')
      .replace(/_/g, '')
  );
}
