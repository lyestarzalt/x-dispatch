import * as fs from 'fs';
import { type FaaChartIndex, parseFaaChartIndex } from '@/lib/parsers/nav/faaChartIndex';
import logger from '@/lib/utils/logger';
import { getAiracCycleDates } from '../cycleInfo';
import { getFaaChartIndexPath } from '../paths';
import {
  type FaaChartError,
  downloadedFaaChartIndex,
  faaChartDownloadState,
} from './faaChartDownload';

let cached: { path: string; mtimeMs: number; index: FaaChartIndex } | null = null;

/**
 * The FAA chart index the user placed in Custom Data, or null when there is none. The file is
 * read again only when it changes, so a new FAA cycle dropped in takes effect on the next
 * airport opened.
 */
function loadCustomDataFaaChartIndex(xplanePath: string): FaaChartIndex | null {
  const filePath = getFaaChartIndexPath(xplanePath);
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(filePath).mtimeMs;
  } catch {
    cached = null;
    return null;
  }
  if (cached?.path === filePath && cached.mtimeMs === mtimeMs) return cached.index;
  try {
    const index = parseFaaChartIndex(fs.readFileSync(filePath, 'utf-8'));
    cached = { path: filePath, mtimeMs, index };
    logger.data.info(
      `FAA chart index in Custom Data: obstacle departures at ${index.obstacleDepartures.size} airports, RNAV departures at ${index.rnavDepartures.size}, RNAV arrivals at ${index.rnavArrivals.size}, ILS OR LOC at ${index.ilsOrLoc.size}`
    );
    return index;
  } catch (err) {
    cached = null;
    logger.data.warn('Could not read the FAA chart index in Custom Data', err);
    return null;
  }
}

/**
 * The FAA chart index for the US procedure labels (OBSTACLE, RNAV, ILS OR LOC): the user's copy
 * in Custom Data, else the one downloaded for them, else null.
 */
export function loadFaaChartIndex(xplanePath: string): FaaChartIndex | null {
  return loadCustomDataFaaChartIndex(xplanePath) ?? downloadedFaaChartIndex();
}

/** Where the labels come from and how current they are, for Settings. */
export interface FaaChartStatus {
  source: 'customData' | 'download' | 'none';
  /** AIRAC cycle of the list in use ("2611"), null when it has none. */
  cycle: string | null;
  /** End of that cycle, ISO; null with no cycle. */
  validUntil: string | null;
  expired: boolean;
  /** When the list in use was downloaded, ISO; null for a Custom Data copy. */
  fetchedAt: string | null;
  downloading: boolean;
  /** Why the last download failed, if it did. */
  error: FaaChartError | null;
}

/** The status with the user's download choice, as Settings shows it. */
export interface FaaChartSettings extends FaaChartStatus {
  enabled: boolean;
}

export function faaChartStatus(xplanePath: string | null, now = new Date()): FaaChartStatus {
  const custom = xplanePath ? loadCustomDataFaaChartIndex(xplanePath) : null;
  const download = faaChartDownloadState();
  const downloaded = custom ? null : downloadedFaaChartIndex();
  const index = custom ?? downloaded;
  const dates = getAiracCycleDates(index?.cycle ?? null);
  return {
    source: custom ? 'customData' : downloaded ? 'download' : 'none',
    cycle: index?.cycle ?? null,
    validUntil: dates?.expirationDate.toISOString() ?? null,
    expired: dates ? now >= dates.expirationDate : false,
    fetchedAt: downloaded ? download.fetchedAt : null,
    downloading: download.downloading,
    error: download.error,
  };
}
