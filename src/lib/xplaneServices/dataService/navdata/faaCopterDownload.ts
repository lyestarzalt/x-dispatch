import * as fs from 'fs';
import * as yauzl from 'yauzl';
import {
  type FaaCopterAirport,
  type FaaCopterProcedures,
  faaCopterFromJson,
  faaCopterToJson,
  parseFaaCopterProcedures,
} from '@/lib/parsers/nav/faaCopterProcedures';
import { errorMessage } from '@/lib/utils/errors';
import { haversineDistance } from '@/lib/utils/geomath';
import logger from '@/lib/utils/logger';
import { airacCycleAt, getAiracCycleDates } from '../cycleInfo';

/**
 * Downloads the FAA's coded procedures (FAACIFP18, a 9 MB archive) once per AIRAC cycle and
 * keeps two things out of it: the helicopter procedures, a few kilobytes, which X-Plane's data
 * has none of (GitHub #432), and the list of named fixes, about 2 MB, which the planner falls
 * back on for a fix X-Plane's database lacks. The download starts by itself shortly after the app does, so the procedures
 * are there when a heliport is first opened; an airport whose FAA chart list names a COPTER
 * chart asks again if that attempt failed. It follows the same Settings switch as the chart
 * list; the data is the FAA's own public-domain publication.
 */

/** The archive of a cycle, named by the cycle's first day (`CIFP_261029.zip`). */
export function faaCifpUrl(cycle: string): string | null {
  const dates = getAiracCycleDates(cycle);
  if (!dates) return null;
  const day = dates.effectiveDate.toISOString().slice(2, 10).replaceAll('-', '');
  return `https://aeronav.faa.gov/Upload_313-d/cifp/CIFP_${day}.zip`;
}

/** The procedure file inside the archive. */
const CIFP_ENTRY = 'FAACIFP18';
/** The file is 53 MB; anything far larger is not it. */
const MAX_ENTRY_BYTES = 256 * 1024 * 1024;

/** `proxyDownload`'s shape: it carries the timeout and logs the failure itself. */
export type FaaCopterFetch = (
  url: string
) => Promise<{ data: Buffer | null; error: string | null }>;

/** Why the last download failed: no answer, or an answer that was not the procedure file. */
export type FaaCopterError = 'network' | 'invalid';

interface Deps {
  download: FaaCopterFetch;
  cachePath: string;
  isEnabled: () => boolean;
  /** Reads one file out of the archive; the default unzips it. */
  extract?: (archive: Buffer, entryName: string) => Promise<string>;
  now?: () => Date;
}

interface CacheFile {
  fetchedAt: string;
  procedures: ReturnType<typeof faaCopterToJson>;
}

const RETRY_AFTER_MS = 30 * 60_000;

let deps: Deps | null = null;
let cached: FaaCopterProcedures | null = null;
/** `cached.fixes` by identifier, built the first time the planner asks for one. */
let fixesById: Map<string, { latitude: number; longitude: number }[]> | null = null;
let cachedFetchedAt: string | null = null;
let inFlight: Promise<FaaCopterError | null> | null = null;
let lastFailureAt: number | null = null;
let lastError: FaaCopterError | null = null;
const listeners = new Set<() => void>();

const now = () => deps?.now?.() ?? new Date();

/** One file of a zip archive held in memory, as text. The FAA's file is plain Latin-1. */
export function extractZipEntry(archive: Buffer, entryName: string): Promise<string> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(archive, { lazyEntries: true }, (openError, zip) => {
      if (openError || !zip) return reject(openError ?? new Error('not a zip archive'));
      zip.on('error', reject);
      zip.on('end', () => reject(new Error(`${entryName} is not in the archive`)));
      zip.on('entry', (entry: yauzl.Entry) => {
        if (entry.fileName !== entryName) return zip.readEntry();
        if (entry.uncompressedSize > MAX_ENTRY_BYTES) {
          return reject(new Error(`${entryName} is ${entry.uncompressedSize} bytes`));
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error('unreadable entry'));
          const chunks: Buffer[] = [];
          stream.on('data', (chunk: Buffer) => chunks.push(chunk));
          stream.on('error', reject);
          stream.on('end', () => {
            zip.close();
            resolve(Buffer.concat(chunks).toString('latin1'));
          });
        });
      });
      zip.readEntry();
    });
  });
}

function readCache(
  cachePath: string
): { procedures: FaaCopterProcedures; fetchedAt: string } | null {
  try {
    const file = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Partial<CacheFile>;
    const procedures = faaCopterFromJson(file.procedures);
    if (!procedures || typeof file.fetchedAt !== 'string') return null;
    return { procedures, fetchedAt: file.fetchedAt };
  } catch {
    return null;
  }
}

/** The state of the download, as Settings shows it under the FAA switch. */
export interface FaaCopterDownloadState {
  /** AIRAC cycle of the file kept ("2611"), null when there is none. */
  cycle: string | null;
  /** When it was downloaded, ISO; null with no file. */
  fetchedAt: string | null;
  downloading: boolean;
  /** Why the last download failed, if it did. */
  error: FaaCopterError | null;
  /** How many named fixes the planner can fall back on. */
  fixCount: number;
}

export function faaCopterDownloadState(): FaaCopterDownloadState {
  return {
    cycle: cached?.cycle ?? null,
    fetchedAt: cached ? cachedFetchedAt : null,
    downloading: inFlight !== null,
    error: lastError,
    fixCount: cached?.fixes.length ?? 0,
  };
}

/** Sets the downloader and the cache file (from main), and reads what a previous run left. */
export function configureFaaCopterDownload(next: Deps): void {
  deps = next;
  inFlight = null;
  lastFailureAt = null;
  lastError = null;
  const kept = readCache(next.cachePath);
  cached = kept?.procedures ?? null;
  cachedFetchedAt = kept?.fetchedAt ?? null;
  fixesById = null;
}

export function onFaaCopterUpdated(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyUpdated(): void {
  for (const listener of listeners) listener();
}

/**
 * The FAA's fix of that name nearest to `near`, while the download is on; null when the list
 * has none. For the planner, when X-Plane's database does not know a typed fix.
 */
export function faaFixNear(
  ident: string,
  near: { latitude: number; longitude: number }
): { latitude: number; longitude: number } | null {
  if (!deps?.isEnabled() || !cached) return null;
  if (!fixesById) {
    fixesById = new Map();
    for (const [id, latitude, longitude] of cached.fixes) {
      const list = fixesById.get(id);
      if (list) list.push({ latitude, longitude });
      else fixesById.set(id, [{ latitude, longitude }]);
    }
  }
  const candidates = fixesById.get(ident.trim().toUpperCase());
  if (!candidates) return null;
  const away = (p: { latitude: number; longitude: number }) =>
    haversineDistance(near.latitude, near.longitude, p.latitude, p.longitude);
  return candidates.reduce((best, p) => (away(p) < away(best) ? p : best));
}

/**
 * The helicopter procedures the FAA codes for an airport or heliport, while the download is
 * on; any cycle until the next one is in. Null when there are none.
 */
export function faaCopterForAirport(icao: string): FaaCopterAirport | null {
  if (!deps?.isEnabled()) return null;
  return cached?.airports.get(icao.trim().toUpperCase()) ?? null;
}

async function download(d: Deps): Promise<FaaCopterError | null> {
  const cycle = airacCycleAt(now());
  const url = faaCifpUrl(cycle);
  if (!url) return 'invalid';
  const startedAt = Date.now();
  const result = await d.download(url);
  if (!result.data) return 'network';

  let procedures: FaaCopterProcedures;
  try {
    const text = await (d.extract ?? extractZipEntry)(result.data, CIFP_ENTRY);
    procedures = parseFaaCopterProcedures(text);
  } catch (error) {
    logger.data.warn(`FAA procedure file ${cycle} unreadable: ${errorMessage(error)}`);
    return 'invalid';
  }
  // A maintenance page or another cycle's file must not replace good data.
  if (procedures.cycle !== cycle) {
    logger.data.warn(
      `FAA procedure file for ${cycle} came back as cycle ${procedures.cycle ?? 'none'}`
    );
    return 'invalid';
  }

  const file: CacheFile = {
    fetchedAt: now().toISOString(),
    procedures: faaCopterToJson(procedures),
  };
  const tmpPath = `${d.cachePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(file), 'utf-8');
    fs.renameSync(tmpPath, d.cachePath);
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    logger.data.warn(
      `FAA helicopter procedures ${cycle} could not be saved: ${errorMessage(error)}`
    );
  }
  cached = procedures;
  cachedFetchedAt = file.fetchedAt;
  fixesById = null;
  logger.data.info(
    `FAA procedure file ${cycle} downloaded in ${Date.now() - startedAt} ms: helicopter procedures at ${procedures.airports.size} airports, ${procedures.fixes.length} fixes`
  );
  return null;
}

/** Downloads the current cycle now, or joins the download already running. */
export function downloadFaaCopter(): Promise<FaaCopterError | null> {
  const d = deps;
  if (!d) return Promise.resolve('network');
  inFlight ??= download(d)
    .catch((error: unknown) => {
      logger.data.warn(`FAA procedure file download failed: ${errorMessage(error)}`);
      return 'network' as const;
    })
    .then((error) => {
      lastFailureAt = error ? now().getTime() : null;
      lastError = error;
      return error;
    })
    .finally(() => {
      inFlight = null;
      notifyUpdated();
    });
  return inFlight;
}

/**
 * Starts a download in the background, at app start (`true`) or when an airport with a COPTER
 * chart opens, unless the procedures kept are already for the current cycle. A failure waits half an hour before the next
 * try, so a machine offline does not ask on every airport.
 */
export function requestFaaCopter(hasCopterChart: boolean): void {
  if (!hasCopterChart || !deps?.isEnabled() || inFlight) return;
  if (cached?.cycle === airacCycleAt(now())) return;
  if (lastFailureAt !== null && now().getTime() - lastFailureAt < RETRY_AFTER_MS) return;
  void downloadFaaCopter();
}

/** Forgets the downloaded procedures, as when the user turns the download off. */
export function clearDownloadedFaaCopter(): void {
  cached = null;
  cachedFetchedAt = null;
  fixesById = null;
  lastFailureAt = null;
  lastError = null;
  if (deps) fs.rmSync(deps.cachePath, { force: true });
  notifyUpdated();
}
