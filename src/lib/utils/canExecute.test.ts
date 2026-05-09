import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { canExecute } from './canExecute';

const TMP_ROOT = path.join(os.tmpdir(), `xd-canexecute-${Date.now()}-${Math.random()}`);

beforeAll(() => {
  fs.mkdirSync(TMP_ROOT, { recursive: true });
});

afterAll(() => {
  fs.rmSync(TMP_ROOT, { recursive: true, force: true });
});

describe('canExecute', () => {
  it('returns ok for an executable file', () => {
    const file = path.join(TMP_ROOT, 'runme.sh');
    fs.writeFileSync(file, '#!/bin/sh\necho hi\n');
    fs.chmodSync(file, 0o755);
    expect(canExecute(file)).toEqual({ ok: true });
  });

  it('returns reason "missing" for a path that does not exist', () => {
    const ghost = path.join(TMP_ROOT, 'never-existed');
    const r = canExecute(ghost);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('missing');
      expect(r.error).toMatch(/ENOENT|no such file/i);
    }
  });

  it('returns reason "denied" for a non-executable file on POSIX', () => {
    if (process.platform === 'win32') return; // X_OK semantics differ; covered separately
    const file = path.join(TMP_ROOT, 'no-x.bin');
    fs.writeFileSync(file, 'plain');
    fs.chmodSync(file, 0o644);
    const r = canExecute(file);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('denied');
    }
  });

  it('treats existing files as ok on Windows even without explicit X bit', () => {
    if (process.platform !== 'win32') return;
    const file = path.join(TMP_ROOT, 'plain.txt');
    fs.writeFileSync(file, 'plain');
    expect(canExecute(file)).toEqual({ ok: true });
  });
});
