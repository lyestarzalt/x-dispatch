import * as fs from 'fs';
import {
  type FaaChartIndex,
  faaChartIndexFromJson,
  faaChartIndexToJson,
  parseFaaChartIndex,
} from '@/lib/parsers/nav/faaChartIndex';
import { errorMessage } from '@/lib/utils/errors';
import logger from '@/lib/utils/logger';
import { airacCycleAt } from '../cycleInfo';

/**
 * Downloads the FAA's chart list (d-tpp_Metafile.xml) once per AIRAC cycle, the first time a
 * US airport's procedures open, and keeps only what the app reads: the procedure names and each
 * chart's title and PDF name (under 2 MB of the 16 MB). The data is the FAA's own public-domain publication; the user can turn the download
 * off in Settings. It is the app's only source of the list.
 */

export function faaMetafileUrl(cycle: string): string {
  return `https://aeronav.faa.gov/d-tpp/${cycle}/xml_data/d-tpp_Metafile.xml`;
}

/** `proxyFetch`'s shape: it carries the timeout and logs the failure itself. */
export type FaaChartFetch = (url: string) => Promise<{ data: string | null; error: string | null }>;

/** Why the last download failed: no answer, or an answer that was not the chart list. */
export type FaaChartError = 'network' | 'invalid';

interface Deps {
  fetchText: FaaChartFetch;
  cachePath: string;
  isEnabled: () => boolean;
  now?: () => Date;
}

interface CacheFile {
  fetchedAt: string;
  index: ReturnType<typeof faaChartIndexToJson>;
}

const RETRY_AFTER_MS = 30 * 60_000;

let deps: Deps | null = null;
let cached: { index: FaaChartIndex; fetchedAt: string } | null = null;
let inFlight: Promise<FaaChartError | null> | null = null;
let lastFailure: { at: number; error: FaaChartError } | null = null;
const listeners = new Set<() => void>();

const now = () => deps?.now?.() ?? new Date();

function readCache(cachePath: string): typeof cached {
  try {
    const file = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as Partial<CacheFile>;
    const index = faaChartIndexFromJson(file.index);
    if (!index || typeof file.fetchedAt !== 'string') return null;
    return { index, fetchedAt: file.fetchedAt };
  } catch {
    return null;
  }
}

/** Sets the fetcher and the cache file (from main), and reads the cache a previous run left. */
export function configureFaaChartDownload(next: Deps): void {
  deps = next;
  inFlight = null;
  lastFailure = null;
  cached = readCache(next.cachePath);
}

export function onFaaChartsUpdated(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyUpdated(): void {
  for (const listener of listeners) listener();
}

/**
 * Airports in the FAA's chart list: the contiguous US (K), Alaska and the Pacific territories
 * (PA, PF, PO, PP, PH, PG, PW, PM), Puerto Rico and the US Virgin Islands (TJ, TI).
 */
export function isUsAirport(icao: string): boolean {
  return /^(K[A-Z0-9]{3}|P[AFOPHGWM][A-Z0-9]{2}|T[JI][A-Z0-9]{2})$/.test(icao.trim().toUpperCase());
}

/** The downloaded list, while the download is on; any cycle until the next one is in. */
export function downloadedFaaChartIndex(): FaaChartIndex | null {
  if (!deps?.isEnabled()) return null;
  return cached?.index ?? null;
}

export function faaChartDownloadState(): {
  cycle: string | null;
  fetchedAt: string | null;
  downloading: boolean;
  error: FaaChartError | null;
} {
  return {
    cycle: cached?.index.cycle ?? null,
    fetchedAt: cached?.fetchedAt ?? null,
    downloading: inFlight !== null,
    error: lastFailure?.error ?? null,
  };
}

async function download(d: Deps): Promise<FaaChartError | null> {
  const cycle = airacCycleAt(now());
  const startedAt = Date.now();
  const result = await d.fetchText(faaMetafileUrl(cycle));
  if (!result.data) return 'network';

  let index: FaaChartIndex;
  try {
    index = parseFaaChartIndex(result.data);
  } catch (error) {
    logger.data.warn(`FAA chart list ${cycle} unreadable: ${errorMessage(error)}`);
    return 'invalid';
  }
  // A maintenance page or another cycle's file must not replace a good list.
  if (index.cycle !== cycle) {
    logger.data.warn(`FAA chart list for ${cycle} came back as cycle ${index.cycle ?? 'none'}`);
    return 'invalid';
  }

  const file: CacheFile = { fetchedAt: now().toISOString(), index: faaChartIndexToJson(index) };
  const tmpPath = `${d.cachePath}.tmp`;
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(file), 'utf-8');
    fs.renameSync(tmpPath, d.cachePath);
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    logger.data.warn(`FAA chart list ${cycle} could not be saved: ${errorMessage(error)}`);
  }
  cached = { index, fetchedAt: file.fetchedAt };
  logger.data.info(
    `FAA chart list ${cycle} downloaded in ${Date.now() - startedAt} ms: ILS OR LOC at ${index.ilsOrLoc.size} airports`
  );
  return null;
}

/** Downloads the current cycle now, or joins the download already running. */
export function downloadFaaCharts(): Promise<FaaChartError | null> {
  const d = deps;
  if (!d) return Promise.resolve('network');
  inFlight ??= download(d)
    .catch((error: unknown) => {
      logger.data.warn(`FAA chart list download failed: ${errorMessage(error)}`);
      return 'network' as const;
    })
    .then((error) => {
      lastFailure = error ? { at: now().getTime(), error } : null;
      return error;
    })
    .finally(() => {
      inFlight = null;
      notifyUpdated();
    });
  return inFlight;
}

/**
 * Starts a download in the background when a US airport opens and the list is not for the
 * current cycle. A failure waits half an hour before the next try, so a machine offline does
 * not ask on every airport.
 */
export function requestFaaCharts(icao: string): void {
  if (!deps?.isEnabled() || !isUsAirport(icao) || inFlight) return;
  if (cached?.index.cycle === airacCycleAt(now())) return;
  if (lastFailure && now().getTime() - lastFailure.at < RETRY_AFTER_MS) return;
  void downloadFaaCharts();
}

/** Forgets the downloaded list, as when the user turns the download off. */
export function clearDownloadedFaaCharts(): void {
  cached = null;
  lastFailure = null;
  if (deps) fs.rmSync(deps.cachePath, { force: true });
  notifyUpdated();
}
