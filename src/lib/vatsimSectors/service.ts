import fs from 'node:fs';
import logger from '@/lib/utils/logger';
import type { VatsimSectorQueryResult } from '@/types/vatsimSectors';
import {
  clearVatsimSectorCache,
  getVatsimSectorPaths,
  readNormalizedDataset,
  readVatsimSectorManifest,
  writeNormalizedDataset,
  writeVatsimSectorManifest,
} from './cache';
import { buildSectorDataset } from './normalize';
import { downloadSimawareBundle, downloadVatspyBundle } from './upstream';

const STALE_MS = 24 * 60 * 60 * 1000;

let refreshPromise: Promise<VatsimSectorQueryResult> | null = null;
const updateListeners = new Set<() => void>();

function notifyUpdated(): void {
  for (const listener of updateListeners) {
    listener();
  }
}

function isStale(checkedAt: string | undefined): boolean {
  if (!checkedAt) {
    return true;
  }

  return Date.now() - new Date(checkedAt).getTime() > STALE_MS;
}

async function refreshInternal(): Promise<VatsimSectorQueryResult> {
  const [vatspy, simaware] = await Promise.all([downloadVatspyBundle(), downloadSimawareBundle()]);
  const builtAt = new Date().toISOString();
  const dataset = buildSectorDataset({
    vatspyVersion: vatspy.version,
    simawareVersion: simaware.version,
    dat: vatspy.dat,
    boundariesText: vatspy.boundaries,
    simaware: JSON.parse(simaware.rawText),
    builtAt,
  });

  const paths = getVatsimSectorPaths();
  fs.mkdirSync(paths.cacheDir, { recursive: true });
  fs.writeFileSync(paths.vatspyDatPath, vatspy.dat);
  fs.writeFileSync(paths.vatspyBoundariesPath, vatspy.boundaries);
  fs.writeFileSync(paths.simawarePath, simaware.rawText);
  writeNormalizedDataset(dataset);
  writeVatsimSectorManifest({
    vatspyVersion: vatspy.version,
    simawareVersion: simaware.version,
    builtAt,
    checkedAt: builtAt,
    lastError: null,
  });

  return { state: 'ready', dataset, lastError: null };
}

export function onVatsimSectorDataUpdated(listener: () => void): () => void {
  updateListeners.add(listener);
  return () => updateListeners.delete(listener);
}

export async function refreshVatsimSectorData(): Promise<VatsimSectorQueryResult> {
  if (!refreshPromise) {
    refreshPromise = refreshInternal()
      .catch((error) => {
        logger.main.error('VATSIM sector refresh failed', error);

        const dataset = readNormalizedDataset();
        const builtAt = new Date().toISOString();
        const previous = readVatsimSectorManifest();
        const lastError = error instanceof Error ? error.message : String(error);

        writeVatsimSectorManifest({
          vatspyVersion: previous?.vatspyVersion ?? 'unknown',
          simawareVersion: previous?.simawareVersion ?? 'unknown',
          builtAt: previous?.builtAt ?? builtAt,
          checkedAt: builtAt,
          lastError,
        });

        return {
          state: dataset ? 'stale' : 'error',
          dataset,
          lastError,
        } satisfies VatsimSectorQueryResult;
      })
      .finally(() => {
        refreshPromise = null;
        notifyUpdated();
      });
  }

  return refreshPromise;
}

export async function getVatsimSectorData(): Promise<VatsimSectorQueryResult> {
  const manifest = readVatsimSectorManifest();
  const dataset = readNormalizedDataset();

  if (!dataset || !manifest) {
    return refreshVatsimSectorData();
  }

  if (isStale(manifest.checkedAt)) {
    void refreshVatsimSectorData();
    return { state: 'stale', dataset, lastError: manifest.lastError };
  }

  return { state: 'ready', dataset, lastError: manifest.lastError };
}

export async function getVatsimSectorStatus(): Promise<VatsimSectorQueryResult['state']> {
  if (refreshPromise) {
    return 'loading';
  }

  const manifest = readVatsimSectorManifest();
  const dataset = readNormalizedDataset();
  if (!manifest || !dataset) {
    return 'empty';
  }

  return isStale(manifest.checkedAt) ? 'stale' : 'ready';
}

export function clearVatsimSectorData(): { success: boolean } {
  clearVatsimSectorCache();
  notifyUpdated();
  return { success: true };
}
