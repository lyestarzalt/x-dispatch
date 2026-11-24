import * as fs from 'fs';
import * as path from 'path';
import { errorMessage } from '@/lib/utils/errors';
import logger from '@/lib/utils/logger';

/**
 * One FAA chart PDF, for laying an approach chart over the map. It is downloaded from the
 * FAA the first time it is shown and kept on disk for the cycle; another cycle's files are
 * dropped when a new one comes in.
 */

/** `proxyDownload`'s shape: it carries the timeout and logs the failure itself. */
export type FaaChartPdfFetch = (
  url: string
) => Promise<{ data: Buffer | null; error: string | null }>;

/**
 * Not a chart address, no answer from the FAA, a chart the FAA does not serve (an old cycle's
 * folder is removed), or an answer that is not a PDF.
 */
export type FaaChartPdfError = 'invalidUrl' | 'network' | 'missing' | 'invalid';

/** The PDF as base64, so it crosses to a tablet as it does to the window. */
export type FaaChartPdfResult = { pdf: string } | { error: FaaChartPdfError };

interface Deps {
  download: FaaChartPdfFetch;
  cacheDir: string;
}

const CHART_URL = /^https:\/\/aeronav\.faa\.gov\/d-tpp\/(\d{4})\/([A-Za-z0-9_-]+\.PDF)$/i;
const PDF_MAGIC = Buffer.from('%PDF-');

let deps: Deps | null = null;
const inFlight = new Map<string, Promise<FaaChartPdfResult>>();

export function configureFaaChartPdf(next: Deps): void {
  deps = next;
  inFlight.clear();
}

const isPdf = (data: Buffer) => data.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);

/** Removes the charts kept for other cycles; they are never asked for again. */
function dropOtherCycles(cacheDir: string, cycle: string): void {
  try {
    for (const entry of fs.readdirSync(cacheDir)) {
      if (entry !== cycle && /^\d{4}$/.test(entry)) {
        fs.rmSync(path.join(cacheDir, entry), { recursive: true, force: true });
      }
    }
  } catch {
    // No cache folder yet.
  }
}

async function load(d: Deps, url: string, cycle: string, file: string): Promise<FaaChartPdfResult> {
  const cyclePath = path.join(d.cacheDir, cycle);
  const filePath = path.join(cyclePath, file.toUpperCase());
  try {
    const kept = fs.readFileSync(filePath);
    if (isPdf(kept)) return { pdf: kept.toString('base64') };
  } catch {
    // Not kept yet.
  }

  const startedAt = Date.now();
  const result = await d.download(url);
  if (!result.data) {
    return { error: /^HTTP 40[34]$/.test(result.error ?? '') ? 'missing' : 'network' };
  }
  if (!isPdf(result.data)) {
    logger.data.warn(`FAA chart ${url} came back as something other than a PDF`);
    return { error: 'invalid' };
  }
  try {
    dropOtherCycles(d.cacheDir, cycle);
    fs.mkdirSync(cyclePath, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    fs.writeFileSync(tmpPath, result.data);
    fs.renameSync(tmpPath, filePath);
  } catch (error) {
    logger.data.warn(`FAA chart ${file} could not be kept: ${errorMessage(error)}`);
  }
  logger.data.info(
    `FAA chart ${cycle}/${file} downloaded in ${Date.now() - startedAt} ms (${result.data.length} bytes)`
  );
  return { pdf: result.data.toString('base64') };
}

/** The chart PDF at an FAA chart address, from disk when it was shown before this cycle. */
export function loadFaaChartPdf(url: unknown): Promise<FaaChartPdfResult> {
  const d = deps;
  const match = typeof url === 'string' ? CHART_URL.exec(url) : null;
  if (!d || !match || typeof url !== 'string') return Promise.resolve({ error: 'invalidUrl' });
  const [, cycle, file] = match as unknown as [string, string, string];
  let pending = inFlight.get(url);
  if (!pending) {
    pending = load(d, url, cycle, file)
      .catch((error: unknown): FaaChartPdfResult => {
        logger.data.warn(`FAA chart ${file} failed: ${errorMessage(error)}`);
        return { error: 'network' };
      })
      .finally(() => inFlight.delete(url));
    inFlight.set(url, pending);
  }
  return pending;
}
