import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  getFileMtime,
  isDirEntry,
  isDirEntrySync,
  isFileEntry,
  isFileEntrySync,
} from './fsEntries';

const canSymlink = process.platform !== 'win32';

describe('fsEntries', () => {
  let root: string;
  const entry = (name: string): fs.Dirent => {
    const found = fs.readdirSync(root, { withFileTypes: true }).find((e) => e.name === name);
    if (!found) throw new Error(`missing ${name}`);
    return found;
  };

  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fs-entries-'));
    fs.mkdirSync(path.join(root, 'dir'));
    fs.writeFileSync(path.join(root, 'file.txt'), 'x');
    if (canSymlink) {
      fs.symlinkSync(path.join(root, 'dir'), path.join(root, 'dirLink'));
      fs.symlinkSync(path.join(root, 'file.txt'), path.join(root, 'fileLink'));
      fs.symlinkSync(path.join(root, 'gone'), path.join(root, 'brokenLink'));
    }
  });

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('recognises plain folders and files', async () => {
    expect(await isDirEntry(entry('dir'), root)).toBe(true);
    expect(await isFileEntry(entry('dir'), root)).toBe(false);
    expect(await isFileEntry(entry('file.txt'), root)).toBe(true);
    expect(isDirEntrySync(entry('dir'), root)).toBe(true);
    expect(isFileEntrySync(entry('file.txt'), root)).toBe(true);
    expect(isDirEntrySync(entry('file.txt'), root)).toBe(false);
  });

  it.runIf(canSymlink)('follows symlinks to their target', async () => {
    expect(await isDirEntry(entry('dirLink'), root)).toBe(true);
    expect(await isFileEntry(entry('fileLink'), root)).toBe(true);
    expect(isDirEntrySync(entry('dirLink'), root)).toBe(true);
    expect(isFileEntrySync(entry('fileLink'), root)).toBe(true);
    expect(await isFileEntry(entry('dirLink'), root)).toBe(false);
  });

  it.runIf(canSymlink)('treats a broken link as neither', async () => {
    expect(await isDirEntry(entry('brokenLink'), root)).toBe(false);
    expect(await isFileEntry(entry('brokenLink'), root)).toBe(false);
    expect(isDirEntrySync(entry('brokenLink'), root)).toBe(false);
    expect(isFileEntrySync(entry('brokenLink'), root)).toBe(false);
  });

  it('reads a modification time, and null for a missing file', () => {
    expect(getFileMtime(path.join(root, 'file.txt'))).toBeGreaterThan(0);
    expect(getFileMtime(path.join(root, 'nope'))).toBeNull();
  });
});
