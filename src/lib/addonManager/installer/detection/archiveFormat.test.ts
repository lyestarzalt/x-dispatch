import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  detectArchiveFormat,
  isArchiveFileName,
  parseSplitVolume,
  prepareArchiveSource,
  sniffArchiveFormat,
} from './archiveFormat';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-fmt-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 1, 2]);
const SEVEN = Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 4, 1, 2]);
const RAR4 = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0xcf, 1, 2]);
const RAR5 = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00, 1, 2]);

function write(name: string, data: Buffer | string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, data);
  return p;
}

describe('sniffArchiveFormat', () => {
  it('reads the format from the first bytes, whatever the name says', () => {
    expect(sniffArchiveFormat(write('a.bin', ZIP))).toBe('zip');
    expect(sniffArchiveFormat(write('b.zip', SEVEN))).toBe('7z');
    expect(sniffArchiveFormat(write('c.dat', RAR4))).toBe('rar');
    expect(sniffArchiveFormat(write('d.dat', RAR5))).toBe('rar');
    expect(sniffArchiveFormat(write('e.zip', 'MZ this is an exe'))).toBeNull();
    expect(sniffArchiveFormat(path.join(dir, 'missing.zip'))).toBeNull();
  });
});

describe('parseSplitVolume', () => {
  it('recognises the common volume naming schemes', () => {
    expect(parseSplitVolume('pack.7z.001')).toEqual({
      kind: 'numbered',
      prefix: 'pack.7z.',
      index: 1,
      width: 3,
    });
    expect(parseSplitVolume('pack.zip.002')).toMatchObject({ kind: 'numbered', index: 2 });
    expect(parseSplitVolume('pack.003')).toMatchObject({ kind: 'numbered', prefix: 'pack.' });
    expect(parseSplitVolume('pack.part1.rar')).toEqual({
      kind: 'rar-part',
      prefix: 'pack.part',
      index: 1,
      width: 1,
    });
    expect(parseSplitVolume('pack.part02.rar')).toMatchObject({ index: 2, width: 2 });
    expect(parseSplitVolume('pack.r00')).toMatchObject({ kind: 'rar-r', index: 0, width: 2 });
    expect(parseSplitVolume('pack.z01')).toMatchObject({ kind: 'zip-z', index: 1 });
  });

  it('leaves ordinary archives alone', () => {
    expect(parseSplitVolume('pack.zip')).toBeNull();
    expect(parseSplitVolume('pack.rar')).toBeNull();
    expect(parseSplitVolume('v1.2.zip')).toBeNull();
    expect(parseSplitVolume('B737-800X_4.01.7z')).toBeNull();
  });
});

describe('isArchiveFileName', () => {
  it('accepts archives and their first volumes only', () => {
    expect(isArchiveFileName('a/b/pack.zip')).toBe(true);
    expect(isArchiveFileName('pack.7Z')).toBe(true);
    expect(isArchiveFileName('pack.part1.rar')).toBe(true);
    expect(isArchiveFileName('pack.part2.rar')).toBe(false);
    expect(isArchiveFileName('pack.7z.001')).toBe(true);
    expect(isArchiveFileName('pack.7z.002')).toBe(false);
    expect(isArchiveFileName('pack.r00')).toBe(false);
    expect(isArchiveFileName('pack.z01')).toBe(false);
    expect(isArchiveFileName('readme.txt')).toBe(false);
  });
});

describe('detectArchiveFormat', () => {
  it('trusts the bytes over the extension', () => {
    expect(detectArchiveFormat(write('wrong.rar', ZIP))).toBe('zip');
  });

  it('falls back to the extension when the file cannot be read', () => {
    expect(detectArchiveFormat(path.join(dir, 'nowhere.7z'))).toBe('7z');
    expect(detectArchiveFormat(path.join(dir, 'nowhere.exe'))).toBeNull();
  });
});

describe('prepareArchiveSource', () => {
  it('hands a 7z volume set to the engine by its first volume', async () => {
    write('pack.7z.001', SEVEN);
    write('pack.7z.002', Buffer.from([3, 4]));
    const dropped = path.join(dir, 'pack.7z.002');
    const result = await prepareArchiveSource(dropped);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.format).toBe('7z');
    expect(result.value.readPath).toBe(path.join(dir, 'pack.7z.001'));
    expect(result.value.volumes).toHaveLength(2);
    await result.value.cleanup();
  });

  it('opens a byte-split zip in place, listing every volume', async () => {
    write('pack.zip.001', ZIP.subarray(0, 4));
    write('pack.zip.002', ZIP.subarray(4));
    const result = await prepareArchiveSource(path.join(dir, 'pack.zip.002'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.format).toBe('zip');
    expect(result.value.readPath).toBe(path.join(dir, 'pack.zip.001'));
    expect(result.value.volumes).toEqual([
      path.join(dir, 'pack.zip.001'),
      path.join(dir, 'pack.zip.002'),
    ]);
    await result.value.cleanup();
  });

  it('names the missing part of a volume set', async () => {
    write('pack.part1.rar', RAR5);
    write('pack.part3.rar', RAR5);
    const result = await prepareArchiveSource(path.join(dir, 'pack.part1.rar'));
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'MISSING_VOLUME',
        path: path.join(dir, 'pack.part1.rar'),
        missing: 'pack.part2.rar',
      },
    });
  });

  it('finds volumes whose case differs from the dropped one', async () => {
    write('Pack.part1.rar', RAR5);
    write('Pack.PART2.rar', RAR5);
    const result = await prepareArchiveSource(path.join(dir, 'Pack.part1.rar'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.volumes).toHaveLength(2);
  });

  it('refuses spanned .z01 zips with a clear code', async () => {
    write('pack.z01', Buffer.from([1, 2]));
    write('pack.zip', ZIP);
    const result = await prepareArchiveSource(path.join(dir, 'pack.z01'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNSUPPORTED_FORMAT');
  });

  it('reports a folder as a folder source', async () => {
    const folder = path.join(dir, 'Some Aircraft');
    fs.mkdirSync(folder);
    const result = await prepareArchiveSource(folder);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.format).toBe('folder');
  });

  it('reports anything else as not an archive', async () => {
    const exe = write('setup.exe', 'MZ');
    expect(await prepareArchiveSource(exe)).toEqual({
      ok: false,
      error: { code: 'NOT_ARCHIVE', path: exe, folder: false },
    });
  });
});
