import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { VatsimSectorDataset, VatsimSectorManifest } from '@/types/vatsimSectors';

function getRootDir(baseDir?: string): string {
  return baseDir ?? app.getPath('userData');
}

export function getVatsimSectorPaths(baseDir?: string) {
  const rootDir = getRootDir(baseDir);
  const cacheDir = path.join(rootDir, 'vatsim-sectors');

  return {
    cacheDir,
    manifestPath: path.join(cacheDir, 'manifest.json'),
    normalizedPath: path.join(cacheDir, 'normalized.json'),
    vatspyDatPath: path.join(cacheDir, 'vatspy.dat'),
    vatspyBoundariesPath: path.join(cacheDir, 'vatspy-boundaries.geojson'),
    simawarePath: path.join(cacheDir, 'simaware-tracon.geojson'),
  };
}

function ensureCacheDir(baseDir?: string): void {
  fs.mkdirSync(getVatsimSectorPaths(baseDir).cacheDir, { recursive: true });
}

export function readVatsimSectorManifest(baseDir?: string): VatsimSectorManifest | null {
  const { manifestPath } = getVatsimSectorPaths(baseDir);
  if (!fs.existsSync(manifestPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as VatsimSectorManifest;
}

export function writeVatsimSectorManifest(manifest: VatsimSectorManifest, baseDir?: string): void {
  ensureCacheDir(baseDir);
  fs.writeFileSync(getVatsimSectorPaths(baseDir).manifestPath, JSON.stringify(manifest, null, 2));
}

export function readNormalizedDataset(baseDir?: string): VatsimSectorDataset | null {
  const { normalizedPath } = getVatsimSectorPaths(baseDir);
  if (!fs.existsSync(normalizedPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(normalizedPath, 'utf8')) as VatsimSectorDataset;
}

export function writeNormalizedDataset(dataset: VatsimSectorDataset, baseDir?: string): void {
  ensureCacheDir(baseDir);
  fs.writeFileSync(getVatsimSectorPaths(baseDir).normalizedPath, JSON.stringify(dataset, null, 2));
}

export function clearVatsimSectorCache(baseDir?: string): void {
  fs.rmSync(getVatsimSectorPaths(baseDir).cacheDir, { recursive: true, force: true });
}
