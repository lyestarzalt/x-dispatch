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
import logger from '@/lib/utils/logger';
import { airacCycleAt, getAiracCycleDates } from '../cycleInfo';

/**
 * Downloads the FAA's coded procedures (FAACIFP18, a 9 MB archive) once per AIRAC cycle and
 * keeps the helicopter procedures out of it, a few kilobytes. X-Plane's data has none of them
 * (GitHub #432). The download starts by itself shortly after the app does, so the procedures
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
let inFlight: Promise<FaaCopterError | null> | null = null;
let lastFailureAt: number | null = null;
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

function readCache(cachePath: string): FaaCopterProcedures | null {
  try {
    const file = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Partial<CacheFile>;
    return faaCopterFromJson(file.procedures);
  } catch {
    return null;
  }
}

/** Sets the downloader and the cache file (from main), and reads what a previous run left. */
export function configureFaaCopterDownload(next: Deps): void {
  deps = next;
  inFlight = null;
  lastFailureAt = null;
  cached = readCache(next.cachePath);
}

export function onFaaCopterUpdated(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyUpdated(): void {
  for (const listener of listeners) listener();
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
  logger.data.info(
    `FAA procedure file ${cycle} downloaded in ${Date.now() - startedAt} ms: helicopter procedures at ${procedures.airports.size} airports`
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
  lastFailureAt = null;
  if (deps) fs.rmSync(deps.cachePath, { force: true });
  notifyUpdated();
}
