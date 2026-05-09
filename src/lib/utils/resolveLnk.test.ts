import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildMinimalLnk } from './buildLnkFixture';
import { resolveLnkSync } from './resolveLnk';

const TMP_ROOT = path.join(os.tmpdir(), `xd-resolvelnk-${Date.now()}-${Math.random()}`);

beforeAll(() => fs.mkdirSync(TMP_ROOT, { recursive: true }));
afterAll(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

describe('resolveLnkSync', () => {
  it('returns the target path for a valid ASCII .lnk', () => {
    const target = path.join(TMP_ROOT, 'real-folder');
    fs.mkdirSync(target);
    const lnkPath = path.join(TMP_ROOT, 'shortcut.lnk');
    fs.writeFileSync(lnkPath, buildMinimalLnk(target, 'ascii'));

    const r = resolveLnkSync(lnkPath);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.targetPath).toBe(target);
  });

  it('returns the target path for a valid UTF-16 .lnk (non-ASCII path)', () => {
    const target = path.join(TMP_ROOT, 'Шереметьево');
    fs.mkdirSync(target);
    const lnkPath = path.join(TMP_ROOT, 'unicode.lnk');
    fs.writeFileSync(lnkPath, buildMinimalLnk(target, 'utf16le'));

    const r = resolveLnkSync(lnkPath);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.targetPath).toBe(target);
  });

  it('returns reason "not-lnk" for a non-.lnk extension', () => {
    const txt = path.join(TMP_ROOT, 'notes.txt');
    fs.writeFileSync(txt, 'plain');
    const r = resolveLnkSync(txt);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('not-lnk');
  });

  it('returns reason "io-error" when the file does not exist', () => {
    const r = resolveLnkSync(path.join(TMP_ROOT, 'never-existed.lnk'));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('io-error');
  });

  it('returns reason "parse-error" for a malformed .lnk', () => {
    const lnkPath = path.join(TMP_ROOT, 'bad.lnk');
    fs.writeFileSync(lnkPath, Buffer.from([0x00, 0x01, 0x02, 0x03])); // garbage
    const r = resolveLnkSync(lnkPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('parse-error');
  });

  it('returns reason "no-target" when the parser yields an empty string', () => {
    const lnkPath = path.join(TMP_ROOT, 'empty-target.lnk');
    fs.writeFileSync(lnkPath, buildMinimalLnk('', 'ascii'));

    const r = resolveLnkSync(lnkPath);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('no-target');
  });
});
