/**
 * The CIFP procedure index (which airports have a SID, STAR or approach) is
 * rebuilt by opening every CIFP file. On a stock install that is ~7,000 files
 * and several seconds on the main process, so the result is cached on disk and
 * keyed on a fingerprint of the CIFP directories (file names, sizes, mtimes).
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { XPLANE_PATHS } from './paths';
import { loadProcedureIcaos } from './procedureIndexCache';

const APPCH = 'APPCH:010,A,I04L,KILMA,KILMA,K6,E,A,EE B, ,   ,IF, , , , , ,      ,    ;\n';
const RWY = 'RWY:RW04 ,     ,      ,00013, ,    , ,   ;N40380000,W073460000\n';

let tempRoot: string;
let root: string;
let cacheFile: string;
let scans: number;

const countingScan = (xplanePath: string) => {
  scans++;
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

function writeCifp(icao: string, contents: string) {
  const dir = path.join(root, XPLANE_PATHS.cifpDir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${icao}.dat`), contents);
}

beforeEach(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-procidx-'));
  root = path.join(tempRoot, 'X-Plane 12');
  cacheFile = path.join(tempRoot, 'userData', 'cifp-procedures.json');
  scans = 0;
});

afterEach(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('loadProcedureIcaos', () => {
  it('scans on the first call and serves the second call from the cache file', () => {
    writeCifp('KEWR', APPCH + RWY);
    writeCifp('00C', RWY);

    const first = loadProcedureIcaos(root, cacheFile, countingScan);
    expect(first.icaos).toEqual(new Set(['KEWR']));
    expect(first.cached).toBe(false);
    expect(fs.existsSync(cacheFile)).toBe(true);

    const second = loadProcedureIcaos(root, cacheFile, countingScan);
    expect(second.icaos).toEqual(new Set(['KEWR']));
    expect(second.cached).toBe(true);
    expect(scans).toBe(1);
  });

  it('rescans when a CIFP file changes size', () => {
    writeCifp('KEWR', RWY);
    expect(loadProcedureIcaos(root, cacheFile, countingScan).icaos).toEqual(new Set());

    writeCifp('KEWR', RWY + APPCH);
    const after = loadProcedureIcaos(root, cacheFile, countingScan);
    expect(after.cached).toBe(false);
    expect(after.icaos).toEqual(new Set(['KEWR']));
    expect(scans).toBe(2);
  });

  it('rescans when a CIFP file is added', () => {
    writeCifp('KEWR', APPCH);
    loadProcedureIcaos(root, cacheFile, countingScan);

    writeCifp('EGLL', APPCH);
    const after = loadProcedureIcaos(root, cacheFile, countingScan);
    expect(after.cached).toBe(false);
    expect(after.icaos).toEqual(new Set(['KEWR', 'EGLL']));
  });

  it('rescans and rewrites when the cache file is unreadable', () => {
    writeCifp('KEWR', APPCH);
    loadProcedureIcaos(root, cacheFile, countingScan);
    fs.writeFileSync(cacheFile, '{not json');

    const after = loadProcedureIcaos(root, cacheFile, countingScan);
    expect(after.cached).toBe(false);
    expect(after.icaos).toEqual(new Set(['KEWR']));
    expect(JSON.parse(fs.readFileSync(cacheFile, 'utf-8')).icaos).toEqual(['KEWR']);
  });

  it('returns an empty set without a cache write when no CIFP folder exists', () => {
    fs.mkdirSync(root, { recursive: true });
    const result = loadProcedureIcaos(root, cacheFile, countingScan);
    expect(result.icaos).toEqual(new Set());
    expect(result.cached).toBe(false);
  });
});
