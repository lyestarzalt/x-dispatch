/**
 * Disk cache for the CIFP procedure index.
 *
 * `listProcedureIcaos` opens every CIFP file (about 7,000 on a stock install)
 * to see whether it holds a SID, STAR or approach. That is seconds of
 * synchronous IO on the main process every time the airport list is fetched.
 * A stat of the same files is a fraction of the cost, so the scan result is
 * stored next to a fingerprint of the CIFP folders (file names, sizes and
 * modification times) and reused until any of them change.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { XPLANE_PATHS, listProcedureIcaos } from './paths';

const CACHE_VERSION = 1;

interface ProcedureIndexCacheFile {
  version: number;
  fingerprint: string;
  icaos: string[];
}

export interface ProcedureIndexResult {
  icaos: Set<string>;
  /** True when the set came from the cache file rather than a fresh scan. */
  cached: boolean;
}

/** Returns null when neither CIFP folder exists, so nothing is worth caching. */
function fingerprintCifpDirs(xplanePath: string): string | null {
  const hash = createHash('sha1');
  let found = false;
  for (const dir of [XPLANE_PATHS.cifpDir, XPLANE_PATHS.customCifp]) {
    const full = path.join(xplanePath, dir);
    let entries: string[];
    try {
      entries = fs.readdirSync(full);
    } catch {
      continue;
    }
    found = true;
    hash.update(`dir:${dir}\n`);
    for (const entry of entries.filter((e) => e.toLowerCase().endsWith('.dat')).sort()) {
      try {
        const stat = fs.statSync(path.join(full, entry));
        hash.update(`${entry}:${stat.size}:${stat.mtimeMs}\n`);
      } catch {
        hash.update(`${entry}:missing\n`);
      }
    }
  }
  return found ? hash.digest('hex') : null;
}

function readCache(cacheFile: string): ProcedureIndexCacheFile | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as ProcedureIndexCacheFile).version === CACHE_VERSION &&
      typeof (parsed as ProcedureIndexCacheFile).fingerprint === 'string' &&
      Array.isArray((parsed as ProcedureIndexCacheFile).icaos)
    ) {
      return parsed as ProcedureIndexCacheFile;
    }
  } catch {
    // Missing or corrupt: treated as a miss.
  }
  return null;
}

function writeCache(cacheFile: string, data: ProcedureIndexCacheFile): void {
  try {
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data));
    fs.renameSync(tmp, cacheFile);
  } catch {
    // A failed cache write only costs the next launch a rescan.
  }
}

/**
 * The set of ICAOs with procedures, from the cache when the CIFP folders are
 * unchanged since it was written, otherwise from a fresh scan that refreshes it.
 */
export function loadProcedureIcaos(
  xplanePath: string,
  cacheFile: string,
  scan: (xplanePath: string) => Set<string> = listProcedureIcaos
): ProcedureIndexResult {
  const fingerprint = fingerprintCifpDirs(xplanePath);
  if (fingerprint === null) return { icaos: new Set(), cached: false };

  const cache = readCache(cacheFile);
  if (cache && cache.fingerprint === fingerprint) {
    return { icaos: new Set(cache.icaos), cached: true };
  }

  const icaos = scan(xplanePath);
  writeCache(cacheFile, { version: CACHE_VERSION, fingerprint, icaos: [...icaos] });
  return { icaos, cached: false };
}
