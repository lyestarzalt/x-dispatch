import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertSameTree, moveIntoPlace, renameWithRetry } from './move';

vi.mock('@/lib/utils/logger', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: { addon: scope } };
});

let dir: string;

function tree(root: string, files: Record<string, string>): string {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-move-'));
});

afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('renameWithRetry', () => {
  it('retries a rename that a scanner holds for a moment', async () => {
    const src = tree(path.join(dir, 'src'), { 'a.txt': 'a' });
    const dst = path.join(dir, 'dst');
    const real = fs.promises.rename.bind(fs.promises);
    let calls = 0;
    vi.spyOn(fs.promises, 'rename').mockImplementation(async (from, to) => {
      calls++;
      if (calls < 3) throw Object.assign(new Error('busy'), { code: 'EPERM' });
      return real(from, to);
    });
    await renameWithRetry(src, dst);
    expect(calls).toBe(3);
    expect(fs.existsSync(path.join(dst, 'a.txt'))).toBe(true);
  });

  it('gives up after the last wait', async () => {
    vi.spyOn(fs.promises, 'rename').mockRejectedValue(
      Object.assign(new Error('busy'), { code: 'EPERM' })
    );
    await expect(renameWithRetry(path.join(dir, 'x'), path.join(dir, 'y'))).rejects.toMatchObject({
      code: 'EPERM',
    });
  });

  it('does not retry a missing source', async () => {
    const spy = vi.spyOn(fs.promises, 'rename');
    await expect(
      renameWithRetry(path.join(dir, 'nope'), path.join(dir, 'y'))
    ).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('moveIntoPlace', () => {
  it('copies beside the destination and renames when the volumes differ', async () => {
    const src = tree(path.join(dir, 'stage'), { 'a.txt': 'a', 'sub/b.txt': 'b' });
    const dst = path.join(dir, 'Aircraft', 'Bird');
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    const real = fs.promises.rename.bind(fs.promises);
    vi.spyOn(fs.promises, 'rename').mockImplementationOnce(async () => {
      throw Object.assign(new Error('xdev'), { code: 'EXDEV' });
    });
    await moveIntoPlace(src, dst);
    expect(fs.readFileSync(path.join(dst, 'sub', 'b.txt'), 'utf8')).toBe('b');
    expect(fs.existsSync(src)).toBe(false);
    expect(fs.readdirSync(path.join(dir, 'Aircraft'))).toEqual(['Bird']);
    await real;
  });

  it('leaves no half-copied folder under the real name when the copy fails', async () => {
    const src = tree(path.join(dir, 'stage'), { 'a.txt': 'a' });
    const dst = path.join(dir, 'Aircraft', 'Bird');
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    vi.spyOn(fs.promises, 'rename').mockImplementationOnce(async () => {
      throw Object.assign(new Error('xdev'), { code: 'EXDEV' });
    });
    vi.spyOn(fs.promises, 'cp').mockRejectedValueOnce(
      Object.assign(new Error('full'), { code: 'ENOSPC' })
    );
    await expect(moveIntoPlace(src, dst)).rejects.toMatchObject({ code: 'ENOSPC' });
    expect(fs.existsSync(dst)).toBe(false);
    expect(fs.readdirSync(path.join(dir, 'Aircraft'))).toEqual([]);
    expect(fs.existsSync(src)).toBe(true);
  });
});

describe('assertSameTree', () => {
  it('passes for a complete copy and fails for a short one', async () => {
    const src = tree(path.join(dir, 'src'), { 'a.txt': 'abc', 'sub/b.txt': 'de' });
    const copy = tree(path.join(dir, 'copy'), { 'a.txt': 'abc', 'sub/b.txt': 'de' });
    await expect(assertSameTree(src, copy, 'backup')).resolves.toBeUndefined();
    fs.writeFileSync(path.join(copy, 'sub', 'b.txt'), 'd');
    await expect(assertSameTree(src, copy, 'backup')).rejects.toMatchObject({
      code: 'INSTALL_FAILED',
    });
  });
});

describe('mergeInto', () => {
  it('merges folders and lets the new install replace a file with a folder and back', async () => {
    const src = tree(path.join(dir, 'src'), {
      'a.txt': 'new a',
      'sub/b.txt': 'new b',
      'was-file/inner.txt': 'now a folder',
      'was-folder': 'now a file',
    });
    const dst = tree(path.join(dir, 'dst'), {
      'a.txt': 'old a',
      'keep.txt': 'kept',
      'sub/c.txt': 'kept c',
      'was-file': 'a file',
      'was-folder/old.txt': 'old',
    });
    const { mergeInto } = await import('./move');
    await mergeInto(src, dst);
    const read = (rel: string) => fs.readFileSync(path.join(dst, ...rel.split('/')), 'utf8');
    expect(read('a.txt')).toBe('new a');
    expect(read('keep.txt')).toBe('kept');
    expect(read('sub/b.txt')).toBe('new b');
    expect(read('sub/c.txt')).toBe('kept c');
    expect(read('was-file/inner.txt')).toBe('now a folder');
    expect(read('was-folder')).toBe('now a file');
  });
});

describe('mergeInto with links', () => {
  it('writes through a link to a folder and replaces a dangling link', async () => {
    const src = tree(path.join(dir, 'src'), { 'CSL/pack.obj': 'obj', 'gone/x.txt': 'x' });
    const elsewhere = tree(path.join(dir, 'elsewhere'), { 'old.obj': 'old' });
    const dst = path.join(dir, 'dst');
    fs.mkdirSync(dst);
    fs.symlinkSync(elsewhere, path.join(dst, 'CSL'), 'dir');
    fs.symlinkSync(path.join(dir, 'missing'), path.join(dst, 'gone'));
    const { mergeInto } = await import('./move');
    await mergeInto(src, dst);
    expect(fs.lstatSync(path.join(dst, 'CSL')).isSymbolicLink()).toBe(true);
    expect(fs.readFileSync(path.join(elsewhere, 'pack.obj'), 'utf8')).toBe('obj');
    expect(fs.readFileSync(path.join(elsewhere, 'old.obj'), 'utf8')).toBe('old');
    expect(fs.lstatSync(path.join(dst, 'gone')).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(dst, 'gone', 'x.txt'), 'utf8')).toBe('x');
  });
});
