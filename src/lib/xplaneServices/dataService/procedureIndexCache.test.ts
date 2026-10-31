/**
 * The CIFP procedure index (which airports have a SID, STAR or approach) is
 * rebuilt by opening every CIFP file: ~7,000 files, seconds on a Mac and over a
 * minute on Windows with real-time antivirus. Nothing may wait on it: a valid
 * cache is served at once, otherwise the rebuild runs in the background and the
 * caller is told when it lands. Cache validity is a fingerprint of the CIFP
 * folders (file names, sizes, mtimes).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { XPLANE_PATHS } from './paths';
import { ProcedureIndex } from './procedureIndexCache';

const APPCH = 'APPCH:010,A,I04L,KILMA,KILMA,K6,E,A,EE B, ,   ,IF, , , , , ,      ,    ;\n';
const RWY = 'RWY:RW04 ,     ,      ,00013, ,    , ,   ;N40380000,W073460000\n';

let tempRoot: string;
let root: string;
let cacheFile: string;
let scans: number;
let releaseScan: (() => void) | null;

/** A scanner the test can hold open, to observe what happens mid-rebuild. */
const countingScan = async (xplanePath: string) => {
  scans++;
  await new Promise<void>((resolve) => {
    releaseScan = resolve;
  });
  const icaos = new Set<string>();
  const dir = path.join(xplanePath, XPLANE_PATHS.cifpDir);
  if (!fs.existsSync(dir)) return icaos;
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith('.dat')) continue;
    if (fs.readFileSync(path.join(dir, entry), 'latin1').includes('APPCH:')) {
      icaos.add(entry.slice(0, -4).toUpperCase());
    }
  }
  return icaos;
};

const tick = () => new Promise((r) => setTimeout(r, 0));

function writeCifp(icao: string, contents: string) {
  const dir = path.join(root, XPLANE_PATHS.cifpDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${icao}.dat`), contents);
}

/** Runs one full cycle: miss, rebuild, release, settle. */
async function warm(index: ProcedureIndex) {
  const first = await index.get(root);
  releaseScan?.();
  releaseScan = null;
  await index.idle();
  return first;
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-procidx-'));
  root = path.join(tempRoot, 'X-Plane 12');
  cacheFile = path.join(tempRoot, 'userData', 'cifp-procedures.json');
  scans = 0;
  releaseScan = null;
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('ProcedureIndex', () => {
  it('answers null at once on a miss and serves the cache once the rebuild lands', async () => {
    writeCifp('KEWR', APPCH + RWY);
    writeCifp('00C', RWY);
    const ready: string[] = [];
    const index = new ProcedureIndex(cacheFile, countingScan, () => ready.push('ready'));

    const miss = await index.get(root);
    expect(miss).toBeNull();
    expect(scans).toBe(1);
    expect(ready).toEqual([]);

    releaseScan?.();
    await index.idle();
    expect(ready).toEqual(['ready']);
    expect(fs.existsSync(cacheFile)).toBe(true);

    expect(await index.get(root)).toEqual(new Set(['KEWR']));
    expect(scans).toBe(1);
  });

  it('runs one rebuild however many callers miss while it is in flight', async () => {
    writeCifp('KEWR', APPCH);
    const ready: string[] = [];
    const index = new ProcedureIndex(cacheFile, countingScan, () => ready.push('ready'));

    expect(await index.get(root)).toBeNull();
    expect(await index.get(root)).toBeNull();
    await tick();
    expect(scans).toBe(1);

    releaseScan?.();
    await index.idle();
    expect(ready).toEqual(['ready']);
  });

  it('rebuilds again when a CIFP file changes size', async () => {
    writeCifp('KEWR', RWY);
    const index = new ProcedureIndex(cacheFile, countingScan, () => {});
    await warm(index);
    expect(await index.get(root)).toEqual(new Set());

    writeCifp('KEWR', RWY + APPCH);
    expect(await warm(index)).toBeNull();
    expect(await index.get(root)).toEqual(new Set(['KEWR']));
    expect(scans).toBe(2);
  });

  it('rebuilds again when a CIFP file is added', async () => {
    writeCifp('KEWR', APPCH);
    const index = new ProcedureIndex(cacheFile, countingScan, () => {});
    await warm(index);

    writeCifp('EGLL', APPCH);
    expect(await warm(index)).toBeNull();
    expect(await index.get(root)).toEqual(new Set(['KEWR', 'EGLL']));
  });

  it('treats an unreadable cache file as a miss and rewrites it', async () => {
    writeCifp('KEWR', APPCH);
    const index = new ProcedureIndex(cacheFile, countingScan, () => {});
    await warm(index);
    fs.writeFileSync(cacheFile, '{not json');

    expect(await warm(index)).toBeNull();
    expect(JSON.parse(fs.readFileSync(cacheFile, 'utf-8')).icaos).toEqual(['KEWR']);
  });

  it('answers an empty set without a rebuild when no CIFP folder exists', async () => {
    fs.mkdirSync(root, { recursive: true });
    const index = new ProcedureIndex(cacheFile, countingScan, () => {});
    expect(await index.get(root)).toEqual(new Set());
    await index.idle();
    expect(scans).toBe(0);
    expect(fs.existsSync(cacheFile)).toBe(false);
  });
});
