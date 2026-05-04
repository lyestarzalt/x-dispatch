import { app } from 'electron';
import logger from '@/lib/utils/logger';

const DEFAULT_TIMEOUT_MS = 15_000;

function createSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs).unref?.();
  return controller.signal;
}

async function fetchText(url: string, init: RequestInit = {}): Promise<string> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'User-Agent': `X-Dispatch/${app.getVersion()}`,
      ...(init.headers ?? {}),
    },
    signal: createSignal(DEFAULT_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

async function fetchJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  return JSON.parse(await fetchText(url, init)) as T;
}

export async function downloadVatspyBundle(): Promise<{
  version: string;
  dat: string;
  boundaries: string;
}> {
  logger.main.info('Downloading VATSpy sector bundle');

  const mapData = await fetchJson<{
    current_commit_hash: string;
    vatspy_dat_url: string;
    fir_boundaries_geojson_url: string;
  }>('https://api.vatsim.net/api/map_data/');

  const [dat, boundaries] = await Promise.all([
    fetchText(mapData.vatspy_dat_url),
    fetchText(mapData.fir_boundaries_geojson_url),
  ]);

  return {
    version: mapData.current_commit_hash,
    dat,
    boundaries,
  };
}

export async function downloadSimawareBundle(): Promise<{
  version: string;
  rawText: string;
}> {
  const release = await fetchJson<{
    tag_name?: string;
    name?: string;
    assets?: { name?: string; browser_download_url?: string }[];
  }>('https://api.github.com/repos/vatsimnetwork/simaware-tracon-project/releases/latest');

  const assetUrl = release.assets?.find(
    (asset) => asset.name === 'TRACONBoundaries.geojson'
  )?.browser_download_url;
  if (!assetUrl) {
    throw new Error('TRACONBoundaries.geojson asset not found');
  }

  const version = release.tag_name ?? release.name ?? 'unknown';
  logger.main.info(`Downloading SimAware TRACON ${version}`);

  return {
    version,
    rawText: await fetchText(assetUrl),
  };
}
