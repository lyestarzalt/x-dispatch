import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ArchiveEntry } from './types';
import { expectedFiles, treeSummary, verifyMarkers, verifyPlacement } from './verify';

let dir: string;

function tree(root: string, files: Record<string, string>): string {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

function entry(p: string, size: number, isDirectory = false): ArchiveEntry {
  return { path: p, isDirectory, uncompressedSize: size, compressedSize: size, encrypted: false };
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-verify-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('expectedFiles', () => {
  it('lists the files that survive the extraction rules, relative to the add-on folder', () => {
    const entries = [
      entry('Bird/', 0, true),
      entry('Bird/bird.acf', 3),
      entry('Bird/objects/wing.obj', 5),
      entry('Bird/__MACOSX/._bird.acf', 9),
      entry('Bird/._bird.acf', 9),
      entry('Other/readme.txt', 1),
    ];
    expect(expectedFiles(entries, { internalRoot: 'Bird/' })).toEqual([
      { relative: 'bird.acf', entryPath: 'Bird/bird.acf', size: 3 },
      { relative: 'objects/wing.obj', entryPath: 'Bird/objects/wing.obj', size: 5 },
    ]);
  });
});

describe('verifyPlacement', () => {
  it('passes when every file is in place at its full size', async () => {
    tree(dir, { 'bird.acf': 'abc', 'objects/wing.obj': 'hello' });
    const result = await verifyPlacement(dir, [
      { relative: 'bird.acf', entryPath: 'Bird/bird.acf', size: 3 },
      { relative: 'objects/wing.obj', entryPath: 'Bird/objects/wing.obj', size: 5 },
    ]);
    expect(result.misplaced).toEqual([]);
    expect(result.stats).toEqual({
      totalFiles: 2,
      verifiedFiles: 2,
      failedFiles: 0,
      skippedFiles: 0,
    });
  });

  it('names a missing file and a truncated one', async () => {
    tree(dir, { 'bird.acf': 'abc', 'objects/wing.obj': 'hel' });
    const result = await verifyPlacement(dir, [
      { relative: 'bird.acf', entryPath: 'Bird/bird.acf', size: 3 },
      { relative: 'objects/wing.obj', entryPath: 'Bird/objects/wing.obj', size: 5 },
      { relative: 'sounds/engine.wav', entryPath: 'Bird/sounds/engine.wav', size: 7 },
    ]);
    expect(result.misplaced).toEqual([
      { relative: 'objects/wing.obj', entryPath: 'Bird/objects/wing.obj', reason: 'size' },
      { relative: 'sounds/engine.wav', entryPath: 'Bird/sounds/engine.wav', reason: 'missing' },
    ]);
    expect(result.stats.failedFiles).toBe(2);
    expect(result.stats.verifiedFiles).toBe(1);
  });
});

describe('verifyMarkers', () => {
  it('rejects an empty folder whatever the type', async () => {
    fs.mkdirSync(path.join(dir, 'deep', 'er'), { recursive: true });
    expect(await verifyMarkers(dir, 'Plugin')).toBe('empty');
  });

  it('wants an .acf within three levels for an aircraft', async () => {
    tree(dir, { 'objects/wing.obj': 'x' });
    expect(await verifyMarkers(dir, 'Aircraft')).toBe('noAcf');
    tree(dir, { 'bird.acf': 'x' });
    expect(await verifyMarkers(dir, 'Aircraft')).toBeNull();
  });

  it('accepts a Gateway airport with apt.dat and no tiles', async () => {
    tree(dir, { 'Earth nav data/apt.dat': 'I\n1000' });
    expect(await verifyMarkers(dir, 'Scenery')).toBeNull();
  });

  it('accepts a mesh with tiles and no apt.dat, and rejects an empty Earth nav data', async () => {
    tree(dir, { 'Earth nav data/+40-080/+47-073.dsf': 'XPLNEDSF', 'readme.txt': 'r' });
    expect(await verifyMarkers(dir, 'Scenery')).toBeNull();
    fs.rmSync(path.join(dir, 'Earth nav data', '+40-080'), { recursive: true });
    expect(await verifyMarkers(dir, 'Scenery')).toBe('noNavFiles');
  });

  it('wants Earth nav data for a scenery and an .xpl for a plugin', async () => {
    tree(dir, { 'objects/thing.obj': 'x' });
    expect(await verifyMarkers(dir, 'Scenery')).toBe('noEarthNavData');
    expect(await verifyMarkers(dir, 'Plugin')).toBe('noXpl');
    tree(dir, { 'mac_x64/thing.xpl': 'x' });
    expect(await verifyMarkers(dir, 'Plugin')).toBeNull();
  });

  it('takes a library by its library.txt', async () => {
    tree(dir, { 'library.txt': 'A\n800\nLIBRARY' });
    expect(await verifyMarkers(dir, 'SceneryLibrary')).toBeNull();
  });
});

describe('treeSummary', () => {
  it('counts files and bytes across the tree', async () => {
    tree(dir, { 'a.txt': 'abc', 'sub/b.txt': 'de', 'sub/deeper/c.txt': '' });
    expect(await treeSummary(dir)).toEqual({ files: 3, bytes: 5 });
  });
});
