import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  containsPath,
  listFilesRecursive,
  moveTree,
  normalizeInternalRoot,
  pruneIgnored,
  sanitizeEntryPath,
  shouldIgnore,
  stripInternalRoot,
} from './entryPaths';

const isWindows = process.platform === 'win32';

describe('sanitizeEntryPath', () => {
  it('keeps an ordinary nested entry', () => {
    expect(sanitizeEntryPath('EGLL/Earth nav data/apt.dat')).toBe('EGLL/Earth nav data/apt.dat');
  });

  it('normalizes backslash separators', () => {
    expect(sanitizeEntryPath('EGLL\\objects\\tower.obj')).toBe('EGLL/objects/tower.obj');
  });

  it('rejects traversal written with either separator', () => {
    expect(sanitizeEntryPath('../../evil.txt')).toBeNull();
    expect(sanitizeEntryPath('..\\..\\evil.txt')).toBeNull();
    expect(sanitizeEntryPath('EGLL/../../evil.txt')).toBeNull();
  });

  it('rejects absolute and drive-qualified paths', () => {
    expect(sanitizeEntryPath('/etc/passwd')).toBeNull();
    expect(sanitizeEntryPath('\\Windows\\System32\\drivers\\etc\\hosts')).toBeNull();
    expect(sanitizeEntryPath('C:/Windows/System32/evil.dll')).toBeNull();
    expect(sanitizeEntryPath('C:evil.dll')).toBeNull();
    expect(sanitizeEntryPath('//server/share/evil.dll')).toBeNull();
  });

  it('drops redundant segments', () => {
    expect(sanitizeEntryPath('./EGLL//objects/')).toBe('EGLL/objects');
  });

  it('rejects an entry that is only separators', () => {
    expect(sanitizeEntryPath('///')).toBeNull();
    expect(sanitizeEntryPath('')).toBeNull();
  });

  it.runIf(isWindows)('rejects names Windows would rewrite', () => {
    expect(sanitizeEntryPath('EGLL/NUL')).toBeNull();
    expect(sanitizeEntryPath('EGLL/com1.txt')).toBeNull();
    expect(sanitizeEntryPath('EGLL/trailing.')).toBeNull();
    expect(sanitizeEntryPath('EGLL/stream:name')).toBeNull();
  });
});

describe('stripInternalRoot', () => {
  it('returns the entry unchanged when there is no root', () => {
    expect(stripInternalRoot('EGLL/apt.dat')).toBe('EGLL/apt.dat');
  });

  it('strips the root with or without a trailing slash', () => {
    expect(stripInternalRoot('EGLL/apt.dat', 'EGLL/')).toBe('apt.dat');
    expect(stripInternalRoot('EGLL/apt.dat', 'EGLL')).toBe('apt.dat');
  });

  it('skips entries outside the root', () => {
    expect(stripInternalRoot('Readme.txt', 'EGLL/')).toBeNull();
    expect(stripInternalRoot('EGLL2/apt.dat', 'EGLL/')).toBeNull();
  });

  it('skips the root folder entry itself', () => {
    expect(stripInternalRoot('EGLL/', 'EGLL/')).toBeNull();
  });

  it('matches roots written with backslashes', () => {
    expect(stripInternalRoot('EGLL\\apt.dat', 'EGLL')).toBe('apt.dat');
  });
});

describe('normalizeInternalRoot', () => {
  it('always ends in a single slash', () => {
    expect(normalizeInternalRoot('EGLL')).toBe('EGLL/');
    expect(normalizeInternalRoot('EGLL/')).toBe('EGLL/');
    expect(normalizeInternalRoot('a\\b')).toBe('a/b/');
  });
});

describe('shouldIgnore', () => {
  it('matches junk at any depth', () => {
    expect(shouldIgnore('__MACOSX/EGLL/apt.dat')).toBe(true);
    expect(shouldIgnore('EGLL/.DS_Store')).toBe(true);
    expect(shouldIgnore('EGLL\\Thumbs.db')).toBe(true);
    expect(shouldIgnore('EGLL/apt.dat')).toBe(false);
  });
});

describe('containsPath', () => {
  const root = path.join(os.tmpdir(), 'xd-contains');

  it('accepts a path inside the target', () => {
    expect(containsPath(root, path.join(root, 'a', 'b.txt'))).toBe(true);
  });

  it('rejects a sibling with a shared prefix', () => {
    expect(containsPath(root, `${root}-other/b.txt`)).toBe(false);
  });

  it('rejects an escape', () => {
    expect(containsPath(root, path.join(root, '..', 'evil.txt'))).toBe(false);
  });
});

describe('moveTree / pruneIgnored / listFilesRecursive', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = path.join(os.tmpdir(), `xd-movetree-${Date.now()}-${Math.random()}`);
    fs.mkdirSync(tmp, { recursive: true });
  });

  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('moves the contents of a staging folder up into the target', () => {
    const staging = path.join(tmp, 'staging', 'MyAddon');
    fs.mkdirSync(path.join(staging, 'objects'), { recursive: true });
    fs.writeFileSync(path.join(staging, 'library.txt'), 'A');
    fs.writeFileSync(path.join(staging, 'objects', 'a.obj'), 'B');

    const target = path.join(tmp, 'target');
    const result = moveTree(staging, target);

    expect(result.failed).toBe(0);
    expect(result.moved).toBe(2);
    expect(fs.existsSync(path.join(target, 'library.txt'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'objects', 'a.obj'))).toBe(true);
    expect(fs.readdirSync(staging)).toHaveLength(0);
  });

  it('merges into folders that already exist', () => {
    const staging = path.join(tmp, 'staging');
    fs.mkdirSync(path.join(staging, 'objects'), { recursive: true });
    fs.writeFileSync(path.join(staging, 'objects', 'new.obj'), 'new');

    const target = path.join(tmp, 'target');
    fs.mkdirSync(path.join(target, 'objects'), { recursive: true });
    fs.writeFileSync(path.join(target, 'objects', 'old.obj'), 'old');

    moveTree(staging, target);

    expect(fs.existsSync(path.join(target, 'objects', 'old.obj'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'objects', 'new.obj'))).toBe(true);
  });

  it('prunes junk folders before anything is moved', () => {
    const staging = path.join(tmp, 'staging');
    fs.mkdirSync(path.join(staging, '__MACOSX', 'EGLL'), { recursive: true });
    fs.writeFileSync(path.join(staging, '__MACOSX', 'EGLL', 'x'), 'junk');
    fs.mkdirSync(path.join(staging, 'EGLL'), { recursive: true });
    fs.writeFileSync(path.join(staging, 'EGLL', '.DS_Store'), 'junk');
    fs.writeFileSync(path.join(staging, 'EGLL', 'apt.dat'), 'real');

    expect(pruneIgnored(staging)).toBe(2);
    expect(listFilesRecursive(staging)).toEqual(['EGLL/apt.dat']);
  });
});
