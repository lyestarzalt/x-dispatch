import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { VatsimSectorDataset, VatsimSectorManifest } from '@/types/vatsimSectors';
import {
  clearVatsimSectorCache,
  getVatsimSectorPaths,
  readNormalizedDataset,
  readVatsimSectorManifest,
  writeNormalizedDataset,
  writeVatsimSectorManifest,
} from './cache';

describe('vatsim sector cache', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xdispatch-vatsim-sectors-'));
  });

  it('writes and reads the manifest from a separate vatsim-sectors directory', () => {
    const manifest: VatsimSectorManifest = {
      vatspyVersion: 'v1',
      simawareVersion: 's1',
      builtAt: '2026-05-04T00:00:00.000Z',
      checkedAt: '2026-05-04T00:00:00.000Z',
      lastError: null,
    };

    writeVatsimSectorManifest(manifest, rootDir);
    const paths = getVatsimSectorPaths(rootDir);

    expect(paths.cacheDir).toBe(path.join(rootDir, 'vatsim-sectors'));
    expect(readVatsimSectorManifest(rootDir)).toEqual(manifest);
  });

  it('writes and reads normalized dataset JSON', () => {
    const dataset: VatsimSectorDataset = {
      version: {
        vatspy: 'v1',
        simaware: 's1',
        builtAt: '2026-05-04T00:00:00.000Z',
      },
      firs: [],
      tracons: [],
    };

    writeNormalizedDataset(dataset, rootDir);

    expect(readNormalizedDataset(rootDir)).toEqual(dataset);
  });

  it('clears only the vatsim-sectors directory', () => {
    const untouched = path.join(rootDir, 'keep-me.txt');
    fs.writeFileSync(untouched, 'keep');

    writeVatsimSectorManifest(
      {
        vatspyVersion: 'v1',
        simawareVersion: 's1',
        builtAt: '2026-05-04T00:00:00.000Z',
        checkedAt: '2026-05-04T00:00:00.000Z',
        lastError: null,
      },
      rootDir
    );

    clearVatsimSectorCache(rootDir);

    expect(fs.existsSync(untouched)).toBe(true);
    expect(fs.existsSync(getVatsimSectorPaths(rootDir).cacheDir)).toBe(false);
  });
});
