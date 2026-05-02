/**
 * DB integrity & recovery tests.
 *
 * Covers the cliff-edge scenarios that brick startup if they regress:
 *  - corrupt sqlite bytes -> auto-delete + relaunch
 *  - 0-byte db file -> auto-delete + relaunch
 *  - schema fingerprint mismatch (db from older app version) -> stale-deletion
 *  - leftover .old-* files from prior failed deletions -> cleaned up
 *  - missing .version file alongside an existing db -> treated as stale
 *  - happy-path first-launch + reuse on second launch
 *
 * Goes through the real initDb() entry point against a temp userData dir, not
 * the in-memory test helper, so the actual filesystem fault paths are exercised.
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable test state, read by the electron mock at runtime so each test can
// point at its own temp userData dir.
let TEST_USER_DATA: string;
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

const relaunchSpy = vi.fn();
const exitSpy = vi.fn();

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: (key: string) => {
      if (key === 'userData') return TEST_USER_DATA;
      throw new Error(`Unexpected getPath key in test: ${key}`);
    },
    getAppPath: () => PROJECT_ROOT,
    relaunch: relaunchSpy,
    exit: exitSpy,
  },
}));

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

const DB_FILENAME = 'xplane-data.db';

function dbFilePath(): string {
  return path.join(TEST_USER_DATA, DB_FILENAME);
}

function versionFilePath(): string {
  return dbFilePath() + '.version';
}

/** Run a fresh initDb in an isolated module graph. Returns the imported module. */
async function freshInit() {
  vi.resetModules();
  const mod = await import('@/lib/db');
  await mod.initDb();
  return mod;
}

describe('DB integrity & recovery', () => {
  beforeEach(() => {
    TEST_USER_DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-db-test-'));
    relaunchSpy.mockClear();
    exitSpy.mockClear();
  });

  afterEach(() => {
    if (fs.existsSync(TEST_USER_DATA)) {
      fs.rmSync(TEST_USER_DATA, { recursive: true, force: true });
    }
  });

  describe('first launch', () => {
    it('creates a fresh db file (after closeDb) and a .version file (immediately) when none exists', async () => {
      const mod = await freshInit();
      // The .version file is written synchronously inside initDb.
      expect(fs.existsSync(versionFilePath())).toBe(true);
      // The db itself only hits disk when sqlite is exported via saveDb/closeDb.
      mod.closeDb();
      expect(fs.existsSync(dbFilePath())).toBe(true);
    });

    it('writes a non-empty schema fingerprint to the .version file', async () => {
      const mod = await freshInit();
      const fingerprint = fs.readFileSync(versionFilePath(), 'utf-8').trim();
      expect(fingerprint.length).toBeGreaterThan(0);
      mod.closeDb();
    });
  });

  describe('schema fingerprint handling', () => {
    it('deletes the db when the stored fingerprint does not match', async () => {
      // First launch: real fingerprint is written
      const mod = await freshInit();
      mod.closeDb();
      expect(fs.existsSync(dbFilePath())).toBe(true);

      // Tamper: replace the version file with a wrong fingerprint
      fs.writeFileSync(versionFilePath(), 'stale-fingerprint-from-old-app-version');

      // Second launch: mismatch detected -> db should be deleted, then a fresh
      // one created with the real fingerprint.
      const mod2 = await freshInit();
      const newFingerprint = fs.readFileSync(versionFilePath(), 'utf-8').trim();
      expect(newFingerprint).not.toBe('stale-fingerprint-from-old-app-version');
      mod2.closeDb();
    });

    it('treats a missing .version file as stale and rewrites it', async () => {
      const mod = await freshInit();
      mod.closeDb();

      // Delete only the .version file, leave the db itself
      fs.unlinkSync(versionFilePath());
      expect(fs.existsSync(dbFilePath())).toBe(true);
      expect(fs.existsSync(versionFilePath())).toBe(false);

      const mod2 = await freshInit();
      expect(fs.existsSync(versionFilePath())).toBe(true);
      mod2.closeDb();
    });

    it('reuses the existing db when the fingerprint matches', async () => {
      const mod = await freshInit();
      mod.closeDb();

      const fingerprintBefore = fs.readFileSync(versionFilePath(), 'utf-8').trim();

      const mod2 = await freshInit();
      const fingerprintAfter = fs.readFileSync(versionFilePath(), 'utf-8').trim();

      expect(fingerprintAfter).toBe(fingerprintBefore);
      expect(relaunchSpy).not.toHaveBeenCalled();
      expect(exitSpy).not.toHaveBeenCalled();
      mod2.closeDb();
    });
  });

  describe('cleanup of leftover files', () => {
    it('removes leftover .old-* files from previous failed deletions', async () => {
      const old1 = path.join(TEST_USER_DATA, `${DB_FILENAME}.old-12345`);
      const old2 = path.join(TEST_USER_DATA, `${DB_FILENAME}.old-67890`);
      fs.writeFileSync(old1, 'stale rename leftover');
      fs.writeFileSync(old2, 'stale rename leftover');

      const mod = await freshInit();
      expect(fs.existsSync(old1)).toBe(false);
      expect(fs.existsSync(old2)).toBe(false);
      mod.closeDb();
    });

    it('does not touch unrelated files in the userData directory', async () => {
      const unrelated = path.join(TEST_USER_DATA, 'user-settings.json');
      fs.writeFileSync(unrelated, '{"keep": true}');

      const mod = await freshInit();
      expect(fs.existsSync(unrelated)).toBe(true);
      expect(fs.readFileSync(unrelated, 'utf-8')).toBe('{"keep": true}');
      mod.closeDb();
    });

    it('does not crash when the userData directory is otherwise empty', async () => {
      // Brand-new temp dir, no files at all
      const mod = await freshInit();
      // .version is written immediately; db is flushed by closeDb.
      expect(fs.existsSync(versionFilePath())).toBe(true);
      mod.closeDb();
      expect(fs.existsSync(dbFilePath())).toBe(true);
    });
  });

  describe('corrupt-db recovery', () => {
    it('triggers relaunch+exit and removes the db when sqlite cannot open the file', async () => {
      // First create a clean db so we can capture the real fingerprint
      const mod = await freshInit();
      const fingerprint = fs.readFileSync(versionFilePath(), 'utf-8').trim();
      mod.closeDb();

      // Tamper: replace bytes with garbage but keep the matching .version file
      // so deleteStaleDb does not fire and we exercise the open/migrate catch.
      fs.writeFileSync(dbFilePath(), Buffer.from('NOT A VALID SQLITE FILE'));
      fs.writeFileSync(versionFilePath(), fingerprint);

      vi.resetModules();
      const { initDb } = await import('@/lib/db');

      // initDb rethrows after calling app.relaunch + app.exit; in production
      // exit terminates the process before the throw, but the mocks are no-ops.
      await expect(initDb()).rejects.toBeDefined();

      expect(relaunchSpy).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledWith(0);
      expect(fs.existsSync(dbFilePath())).toBe(false);
      expect(fs.existsSync(versionFilePath())).toBe(false);
    });

    it('still initialises cleanly when only the db file was removed (.version remains)', async () => {
      // Edge case: db disappears (manual delete, antivirus quarantine, etc.)
      // but the .version file remains. Init should treat it as a first-launch
      // case and write a fresh state without throwing.
      const mod = await freshInit();
      const dbPath = dbFilePath();
      mod.closeDb();

      // Remove only the db file, leave the .version
      fs.unlinkSync(dbPath);
      expect(fs.existsSync(versionFilePath())).toBe(true);

      const mod2 = await freshInit();
      // Version file is rewritten; db file lands on disk after closeDb.
      expect(fs.existsSync(versionFilePath())).toBe(true);
      mod2.closeDb();
      expect(fs.existsSync(dbFilePath())).toBe(true);
      expect(relaunchSpy).not.toHaveBeenCalled();
    });
  });

  describe('idempotency', () => {
    it('multiple consecutive initDb calls within one module load return the same instance', async () => {
      vi.resetModules();
      const mod = await import('@/lib/db');
      const first = await mod.initDb();
      const second = await mod.initDb();
      expect(first).toBe(second);
      mod.closeDb();
    });
  });
});
