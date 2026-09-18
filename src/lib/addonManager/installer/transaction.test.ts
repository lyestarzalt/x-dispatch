import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/utils/logger', () => {
  const noop = () => {};
  const channel = { info: noop, warn: noop, error: noop, debug: noop };
  return {
    default: {
      info: noop,
      warn: noop,
      error: noop,
      debug: noop,
      main: channel,
      data: channel,
      ipc: channel,
      security: channel,
      launcher: channel,
      tracker: channel,
      addon: channel,
    },
    getLogPath: () => '/tmp/test.log',
  };
});

const { InstallTransaction } = await import('./transaction');

let tmp: string;
let backupRoot: string;
let staging: string;
let target: string;

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function read(file: string): string {
  return fs.readFileSync(file, 'utf-8');
}

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `xd-txn-${Date.now()}-${Math.random()}`);
  backupRoot = path.join(tmp, 'backups');
  staging = path.join(tmp, 'staging');
  target = path.join(tmp, 'X-Plane 12', 'Custom Scenery', 'EGLL');
  fs.mkdirSync(staging, { recursive: true });
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('InstallTransaction', () => {
  it('merges staged files into an existing folder', async () => {
    write(path.join(target, 'keep.txt'), 'original');
    write(path.join(target, 'shared.txt'), 'old');
    write(path.join(staging, 'shared.txt'), 'new');
    write(path.join(staging, 'objects', 'a.obj'), 'obj');

    const txn = new InstallTransaction(backupRoot, 'EGLL');
    await txn.apply([{ tempDir: staging, targetPath: target, clean: false }]);

    expect(read(path.join(target, 'keep.txt'))).toBe('original');
    expect(read(path.join(target, 'shared.txt'))).toBe('new');
    expect(read(path.join(target, 'objects', 'a.obj'))).toBe('obj');
  });

  it('restores replaced files and removes created ones on rollback', async () => {
    write(path.join(target, 'shared.txt'), 'old');
    write(path.join(staging, 'shared.txt'), 'new');
    write(path.join(staging, 'objects', 'a.obj'), 'obj');

    const txn = new InstallTransaction(backupRoot, 'EGLL');
    await txn.apply([{ tempDir: staging, targetPath: target, clean: false }]);
    await txn.rollback();

    expect(read(path.join(target, 'shared.txt'))).toBe('old');
    expect(fs.existsSync(path.join(target, 'objects', 'a.obj'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'objects'))).toBe(false);
  });

  it('leaves folders that existed before the install', async () => {
    write(path.join(target, 'objects', 'existing.obj'), 'old');
    write(path.join(staging, 'objects', 'new.obj'), 'new');

    const txn = new InstallTransaction(backupRoot, 'EGLL');
    await txn.apply([{ tempDir: staging, targetPath: target, clean: false }]);
    await txn.rollback();

    expect(fs.existsSync(path.join(target, 'objects', 'existing.obj'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'objects', 'new.obj'))).toBe(false);
  });

  it('moves the whole target aside for a clean install and puts it back', async () => {
    write(path.join(target, 'old', 'stale.txt'), 'stale');
    write(path.join(staging, 'fresh.txt'), 'fresh');

    const txn = new InstallTransaction(backupRoot, 'EGLL');
    await txn.apply([{ tempDir: staging, targetPath: target, clean: true }]);

    expect(fs.existsSync(path.join(target, 'old', 'stale.txt'))).toBe(false);
    expect(read(path.join(target, 'fresh.txt'))).toBe('fresh');

    await txn.rollback();

    expect(read(path.join(target, 'old', 'stale.txt'))).toBe('stale');
    expect(fs.existsSync(path.join(target, 'fresh.txt'))).toBe(false);
  });

  it('reports a backup folder only when something was replaced', async () => {
    write(path.join(staging, 'fresh.txt'), 'fresh');

    const fresh = new InstallTransaction(backupRoot, 'EGLL');
    await fresh.apply([{ tempDir: staging, targetPath: target, clean: false }]);
    expect(fresh.getBackupPath()).toBeNull();

    write(path.join(staging, 'fresh.txt'), 'second');
    const overwrite = new InstallTransaction(backupRoot, 'EGLL');
    await overwrite.apply([{ tempDir: staging, targetPath: target, clean: false }]);
    expect(overwrite.getBackupPath()).not.toBeNull();
  });

  it('applies several components in one transaction', async () => {
    const scripts = path.join(tmp, 'FlyWithLua', 'Scripts');
    const modules = path.join(tmp, 'FlyWithLua', 'Modules');
    const stagedScripts = path.join(tmp, 'staged-scripts');
    const stagedModules = path.join(tmp, 'staged-modules');
    write(path.join(stagedScripts, 'a.lua'), 'script');
    write(path.join(stagedModules, 'b.lua'), 'module');

    const txn = new InstallTransaction(backupRoot, 'pack');
    await txn.apply([
      { tempDir: stagedScripts, targetPath: scripts, clean: false },
      { tempDir: stagedModules, targetPath: modules, clean: false },
    ]);

    expect(read(path.join(scripts, 'a.lua'))).toBe('script');
    expect(read(path.join(modules, 'b.lua'))).toBe('module');

    await txn.rollback();

    expect(fs.existsSync(path.join(scripts, 'a.lua'))).toBe(false);
    expect(fs.existsSync(path.join(modules, 'b.lua'))).toBe(false);
  });

  it('keeps only the most recent backup sets', async () => {
    for (let i = 0; i < 8; i++) {
      fs.mkdirSync(path.join(backupRoot, `set_${i}`), { recursive: true });
      fs.utimesSync(path.join(backupRoot, `set_${i}`), i + 1, i + 1);
    }

    await InstallTransaction.pruneBackups(backupRoot);

    const remaining = fs.readdirSync(backupRoot).sort();
    expect(remaining).toEqual(['set_3', 'set_4', 'set_5', 'set_6', 'set_7']);
  });
});
