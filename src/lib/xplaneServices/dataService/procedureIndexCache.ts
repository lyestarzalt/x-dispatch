/**
 * The CIFP procedure index: which airports have a SID, STAR or approach.
 *
 * Building it means opening every CIFP file (about 7,000 on a stock install).
 * That took seconds on a Mac and over a minute on Windows with real-time
 * antivirus, and in 2.9.0 it ran synchronously inside the airport list fetch,
 * which froze the main process at startup. Nothing waits on it any more:
 *
 *  - a cache file next to a fingerprint of the CIFP folders (file names, sizes
 *    and mtimes) is served when the folders are unchanged;
 *  - on a miss, `get` answers null straight away and one rebuild runs in the
 *    background, after which `onReady` fires so the caller can refetch.
 */
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { XPLANE_PATHS, listProcedureIcaos } from './paths';

const CACHE_VERSION = 1;
/** Files stat'ed at once while fingerprinting. */
const STAT_CONCURRENCY = 32;

interface ProcedureIndexCacheFile {
  version: number;
  fingerprint: string;
  icaos: string[];
}

export type ProcedureScanner = (xplanePath: string) => Promise<Set<string>>;

/** Returns null when neither CIFP folder exists, so there is nothing to index. */
async function fingerprintCifpDirs(xplanePath: string): Promise<string | null> {
  const hash = createHash('sha1');
  let found = false;
  for (const dir of [XPLANE_PATHS.cifpDir, XPLANE_PATHS.customCifp]) {
    const full = path.join(xplanePath, dir);
    let entries: string[];
    try {
      entries = await fs.promises.readdir(full);
    } catch {
      continue;
    }
    found = true;
    hash.update(`dir:${dir}\n`);
    const files = entries.filter((e) => e.toLowerCase().endsWith('.dat')).sort();
    for (let i = 0; i < files.length; i += STAT_CONCURRENCY) {
      const batch = files.slice(i, i + STAT_CONCURRENCY);
      const stats = await Promise.all(
        batch.map((entry) => fs.promises.stat(path.join(full, entry)).catch(() => null))
      );
      batch.forEach((entry, j) => {
        const stat = stats[j];
        hash.update(stat ? `${entry}:${stat.size}:${stat.mtimeMs}\n` : `${entry}:missing\n`);
      });
    }
  }
  return found ? hash.digest('hex') : null;
}

async function readCache(cacheFile: string): Promise<ProcedureIndexCacheFile | null> {
  try {
    const parsed: unknown = JSON.parse(await fs.promises.readFile(cacheFile, 'utf-8'));
    const file = parsed as ProcedureIndexCacheFile;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      file.version === CACHE_VERSION &&
      typeof file.fingerprint === 'string' &&
      Array.isArray(file.icaos)
    ) {
      return file;
    }
  } catch {
    // Missing or corrupt: a miss.
  }
  return null;
}

async function writeCache(cacheFile: string, data: ProcedureIndexCacheFile): Promise<void> {
  try {
    await fs.promises.mkdir(path.dirname(cacheFile), { recursive: true });
    const tmp = `${cacheFile}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(data));
    await fs.promises.rename(tmp, cacheFile);
  } catch {
    // A failed write only costs the next launch a rebuild.
  }
}

export class ProcedureIndex {
  private rebuild: Promise<void> | null = null;

  constructor(
    private readonly cacheFile: string,
    private readonly scan: ProcedureScanner = listProcedureIcaos,
    private readonly onReady: () => void
  ) {}

  /**
   * The ICAOs with procedures when the cache matches the CIFP folders, an
   * empty set when there are no CIFP folders, or null when a rebuild is needed:
   * one is then running in the background and `onReady` fires when it lands.
   */
  async get(xplanePath: string): Promise<Set<string> | null> {
    const fingerprint = await fingerprintCifpDirs(xplanePath);
    if (fingerprint === null) return new Set();

    const cache = await readCache(this.cacheFile);
    if (cache && cache.fingerprint === fingerprint) return new Set(cache.icaos);

    this.rebuild ??= this.runRebuild(xplanePath, fingerprint);
    return null;
  }

  /** Resolves once no rebuild is in flight; for callers that need the index now, and tests. */
  async idle(): Promise<void> {
    await this.rebuild;
  }

  private async runRebuild(xplanePath: string, fingerprint: string): Promise<void> {
    try {
      const icaos = await this.scan(xplanePath);
      await writeCache(this.cacheFile, { version: CACHE_VERSION, fingerprint, icaos: [...icaos] });
      this.onReady();
    } finally {
      this.rebuild = null;
    }
  }
}
