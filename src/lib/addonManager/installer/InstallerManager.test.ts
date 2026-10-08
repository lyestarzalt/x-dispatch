import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InstallerManager } from './InstallerManager';

vi.mock('@/lib/utils/logger', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: { addon: scope, security: scope } };
});

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-installer-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('InstallerManager.analyze', () => {
  it('reports a dropped folder as not an archive', async () => {
    const folder = path.join(dir, 'Aircraft Folder');
    fs.mkdirSync(folder);
    const result = await new InstallerManager(dir).analyze([folder]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_ARCHIVE', path: folder, folder: true },
    });
  });

  it('reports a file that is not an archive as not an archive', async () => {
    const file = path.join(dir, 'setup.exe');
    fs.writeFileSync(file, 'MZ');
    const result = await new InstallerManager(dir).analyze([file]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_ARCHIVE', path: file, folder: false },
    });
  });

  it('keeps the error code for an archive that cannot be read', async () => {
    const file = path.join(dir, 'broken.zip');
    fs.writeFileSync(file, 'not a zip');
    const result = await new InstallerManager(dir).analyze([file]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.error.code).toBe('string');
  });
});
