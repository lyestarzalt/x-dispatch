import { type FaaChartIndex, faaChartUrl } from '@/lib/parsers/nav/faaChartIndex';
import { getAiracCycleDates } from '../cycleInfo';
import {
  type FaaChartError,
  downloadedFaaChartIndex,
  faaChartDownloadState,
} from './faaChartDownload';
import type { FaaCopterDownloadState } from './faaCopterDownload';

/**
 * The FAA chart index behind the US procedure labels (OBSTACLE, RNAV, ILS OR LOC) and the
 * airport chart lists: the one the app downloaded for the cycle, or null while there is none.
 * It is the only source: a `d-tpp_Metafile.xml` in Custom Data is no longer read, because a
 * forgotten copy kept an install on an expired cycle without a word (owner, 2026-11-24).
 */
export function loadFaaChartIndex(): FaaChartIndex | null {
  return downloadedFaaChartIndex();
}

/** One chart with the address of its PDF on the FAA's server. */
export interface FaaChartLink {
  code: string;
  name: string;
  url: string;
  /** True when the chart can be laid over the map: its PDF carries its map position. */
  overlay: boolean;
}

/** A US airport's charts for the cycle of the list in use. */
export interface FaaAirportCharts {
  cycle: string;
  /** The list's cycle has ended: the FAA drops old cycles, so its links may no longer open. */
  expired: boolean;
  charts: FaaChartLink[];
}

/**
 * The charts the FAA lists for an airport, each with its PDF link, or null when the list has
 * none for it (no list, a list without a cycle, an airport outside the US).
 */
export function faaChartsForAirport(icao: string, now = new Date()): FaaAirportCharts | null {
  const index = loadFaaChartIndex();
  const cycle = index?.cycle;
  const charts = index?.charts.get(icao.trim().toUpperCase());
  if (!cycle || !charts?.length) return null;
  const dates = getAiracCycleDates(cycle);
  return {
    cycle,
    expired: dates ? now >= dates.expirationDate : false,
    charts: charts.map((c) => ({
      code: c.code,
      name: c.name,
      url: faaChartUrl(cycle, c.pdf),
      overlay: c.mapPosition,
    })),
  };
}

/** Where the labels come from and how current they are, for Settings. */
export interface FaaChartStatus {
  source: 'download' | 'none';
  /** AIRAC cycle of the list in use ("2611"), null when it has none. */
  cycle: string | null;
  /** End of that cycle, ISO; null with no cycle. */
  validUntil: string | null;
  expired: boolean;
  /** When the list in use was downloaded, ISO; null with no list. */
  fetchedAt: string | null;
  downloading: boolean;
  /** Why the last download failed, if it did. */
  error: FaaChartError | null;
}

/** The status with the user's download choice, as Settings shows it. */
export interface FaaChartSettings extends FaaChartStatus {
  enabled: boolean;
  /** The FAA's coded procedures: helicopter procedures and the planner's fallback fixes. */
  procedures: FaaCopterDownloadState;
}

export function faaChartStatus(now = new Date()): FaaChartStatus {
  const download = faaChartDownloadState();
  const index = downloadedFaaChartIndex();
  const dates = getAiracCycleDates(index?.cycle ?? null);
  return {
    source: index ? 'download' : 'none',
    cycle: index?.cycle ?? null,
    validUntil: dates?.expirationDate.toISOString() ?? null,
    expired: dates ? now >= dates.expirationDate : false,
    fetchedAt: index ? download.fetchedAt : null,
    downloading: download.downloading,
    error: download.error,
  };
}
