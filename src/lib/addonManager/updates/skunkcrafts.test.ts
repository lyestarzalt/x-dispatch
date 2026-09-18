import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type SkunkCraftsManifest,
  crc32,
  isAllowedUpdateUrl,
  parsePathList,
  parseVersion,
  parseWhitelist,
  planUpdate,
} from './skunkcrafts';

let tmp: string;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `xd-skunk-${Date.now()}-${Math.random()}`);
  fs.mkdirSync(tmp, { recursive: true });
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

function write(relative: string, contents: string): Buffer {
  const full = path.join(tmp, ...relative.split('/'));
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents);
  return Buffer.from(contents);
}

function manifest(partial: Partial<SkunkCraftsManifest> = {}): SkunkCraftsManifest {
  return {
    version: '1.2.3',
    baseUrl: 'https://updates.example.com/addon',
    files: [],
    blacklist: [],
    once: [],
    ...partial,
  };
}

describe('crc32', () => {
  it('matches the known value for a reference string', () => {
    expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926);
  });

  it('is zero for empty input', () => {
    expect(crc32(Buffer.alloc(0))).toBe(0);
  });
});

describe('manifest parsing', () => {
  it('reads path, crc and size from a whitelist', () => {
    const entries = parseWhitelist(
      ['objects/a.obj|1234567|890', '# comment', '', 'Earth nav data/apt.dat|42|7'].join('\n')
    );

    expect(entries).toEqual([
      { path: 'objects/a.obj', crc32: 1234567, size: 890 },
      { path: 'Earth nav data/apt.dat', crc32: 42, size: 7 },
    ]);
  });

  it('drops entries that try to escape the addon folder', () => {
    const entries = parseWhitelist(
      ['../../evil.dll|1|1', '/etc/passwd|1|1', 'C:/Windows/evil.dll|1|1', 'ok.txt|1|1'].join('\n')
    );

    expect(entries.map((e) => e.path)).toEqual(['ok.txt']);
  });

  it('drops malformed lines rather than failing the update', () => {
    const entries = parseWhitelist(['no-fields', 'a.txt|notanumber|5', 'b.txt|1|2'].join('\n'));
    expect(entries.map((e) => e.path)).toEqual(['b.txt']);
  });

  it('reads a plain path list', () => {
    expect(parsePathList(['old/file.obj', '', '# note', 'other.txt|1'].join('\n'))).toEqual([
      'old/file.obj',
      'other.txt',
    ]);
  });

  it('reads the version out of a cfg', () => {
    expect(parseVersion('module|https://x/y\nversion|2.4.1\ndisabled|false')).toBe('2.4.1');
    expect(parseVersion('module|https://x/y')).toBe('');
  });
});

describe('isAllowedUpdateUrl', () => {
  it('accepts a public https server', () => {
    expect(isAllowedUpdateUrl('https://updates.example.com/addon')).toBe(true);
  });

  it('refuses plain http and the local network', () => {
    expect(isAllowedUpdateUrl('http://updates.example.com')).toBe(false);
    expect(isAllowedUpdateUrl('https://localhost/x')).toBe(false);
    expect(isAllowedUpdateUrl('https://127.0.0.1/x')).toBe(false);
    expect(isAllowedUpdateUrl('https://192.168.1.10/x')).toBe(false);
    expect(isAllowedUpdateUrl('https://10.0.0.5/x')).toBe(false);
    expect(isAllowedUpdateUrl('https://172.20.0.5/x')).toBe(false);
    expect(isAllowedUpdateUrl('https://169.254.1.1/x')).toBe(false);
    expect(isAllowedUpdateUrl('https://nas.local/x')).toBe(false);
  });
});

describe('planUpdate', () => {
  it('downloads only the files whose checksum differs', async () => {
    const same = write('objects/same.obj', 'unchanged');
    write('objects/changed.obj', 'old contents');

    const plan = await planUpdate(
      tmp,
      manifest({
        files: [
          { path: 'objects/same.obj', crc32: crc32(same), size: same.length },
          { path: 'objects/changed.obj', crc32: 999, size: 12 },
          { path: 'objects/new.obj', crc32: 123, size: 4 },
        ],
      })
    );

    expect(plan.download.map((e) => e.path)).toEqual(['objects/changed.obj', 'objects/new.obj']);
    expect(plan.unchangedCount).toBe(1);
    expect(plan.downloadBytes).toBe(16);
  });

  it('leaves a not-shared file alone once it exists', async () => {
    write('prefs.cfg', 'my settings');

    const plan = await planUpdate(
      tmp,
      manifest({
        files: [{ path: 'prefs.cfg', crc32: 1, size: 1 }],
        once: ['prefs.cfg'],
      })
    );

    expect(plan.download).toHaveLength(0);
    expect(plan.unchangedCount).toBe(1);
  });

  it('fetches a not-shared file that is missing', async () => {
    const plan = await planUpdate(
      tmp,
      manifest({
        files: [{ path: 'prefs.cfg', crc32: 1, size: 1 }],
        once: ['prefs.cfg'],
      })
    );

    expect(plan.download.map((e) => e.path)).toEqual(['prefs.cfg']);
  });

  it('only lists blacklisted files that are actually there', async () => {
    write('retired.obj', 'old');

    const plan = await planUpdate(
      tmp,
      manifest({
        files: [{ path: 'keep.txt', crc32: 1, size: 1 }],
        blacklist: ['retired.obj', 'never-existed.obj'],
      })
    );

    expect(plan.remove).toEqual(['retired.obj']);
  });
});
