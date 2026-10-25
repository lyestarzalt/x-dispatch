import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readLogTail } from './logTail';

let dir = '';

describe('readLogTail', () => {
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-logtail-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns the whole file when it fits', () => {
    const p = path.join(dir, 'main.log');
    fs.writeFileSync(p, 'line 1\nline 2\n');
    expect(readLogTail(p, 1024)).toBe('line 1\nline 2\n');
  });

  it('cuts to the limit and drops the partial first line', () => {
    const p = path.join(dir, 'main.log');
    fs.writeFileSync(p, 'first line is long\nsecond\nthird\n');
    expect(readLogTail(p, 10)).toBe('third\n');
  });

  it('returns null for a missing or empty file', () => {
    expect(readLogTail(path.join(dir, 'nope.log'))).toBeNull();
    const p = path.join(dir, 'empty.log');
    fs.writeFileSync(p, '');
    expect(readLogTail(p)).toBeNull();
  });
});
