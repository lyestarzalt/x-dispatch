/**
 * Nav data loader tests against a fake X-Plane folder tree and a real
 * in-memory SQLite database. Covers the user_nav.dat / user_fix.dat merge
 * (pilot-created navaids, issue #320) and its cache invalidation.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeTestDb, createTestDb, getTestDb } from '../../../../../tests/helpers/db';

// ---------------------------------------------------------------------------
// Mock Electron globals and logger — not available in the Vitest node environment.
// ---------------------------------------------------------------------------
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' },
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

// ---------------------------------------------------------------------------
// Mock @/lib/db so navCache uses the test DB instead of the Electron DB.
// ---------------------------------------------------------------------------
vi.mock('@/lib/db', async () => {
  const schema = await import('@/lib/db/schema');
  return {
    ...schema,
    getDb: () => getTestDb(),
  };
});

const { loadNavaids, loadWaypoints, checkMergedNavValidity } = await import('./navLoader');
const { getAllNavaidsFromDb, getAllWaypointsFromDb } = await import('./navCache');

// ---------------------------------------------------------------------------
// Fake X-Plane tree
// ---------------------------------------------------------------------------

const NAV_HEADER = 'I\n1200 Version - data cycle 2610, build 20260927, metadata NavXP1200.\n\n';
const FIX_HEADER = 'I\n1200 Version - data cycle 2610, build 20260927, metadata FixXP1200.\n\n';

const EARTH_NAV_LINE =
  ' 3   9.037805556    7.285111111     1191    11630   130     -0.000  ABC ENRT DN ABUJA VOR/DME';
/** The exact custom NDB from issue #320. */
const USER_NAV_LINE =
  ' 2  62.956600001  -155.602600001        0      200    50      0.000  MCG ENRT PA MCGRATH NDB';
const USER_NAV_LINE_2 =
  ' 2  63.100000000  -156.000000000        0      200    50      0.000  ZZT ENRT PA ZZTOP NDB';

const EARTH_FIX_LINE = ' -1.000000000  -10.000000000  0110W ENRT GO 2115159 01S010W';
const USER_FIX_LINE = ' 62.900000000 -155.500000000  MYFIX ENRT PA 2115159 MYFIX';

let root: string;

function write(relative: string, lines: string[], header: string, mtimeSeconds?: number): string {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${header}${lines.join('\n')}\n99\n`);
  if (mtimeSeconds !== undefined) fs.utimesSync(filePath, mtimeSeconds, mtimeSeconds);
  return filePath;
}

const writeEarthNav = () =>
  write('Resources/default data/earth_nav.dat', [EARTH_NAV_LINE], NAV_HEADER, 1_000_000_000);
const writeUserNav = (lines: string[], mtime: number) =>
  write('Custom Data/user_nav.dat', lines, NAV_HEADER, mtime);

describe('loadNavaids with user_nav.dat', () => {
  beforeEach(async () => {
    await createTestDb();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-navloader-'));
  });

  afterEach(() => {
    closeTestDb();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('merges user_nav.dat navaids with earth_nav.dat (#320)', async () => {
    writeEarthNav();
    writeUserNav([USER_NAV_LINE], 1_000_000_100);

    const result = await loadNavaids(root);

    expect(result.count).toBe(2);
    const ids = getAllNavaidsFromDb().map((n) => n.id);
    expect(ids).toContain('ABC');
    expect(ids).toContain('MCG');
  });

  it('stays cached across runs when there is no user_nav.dat', async () => {
    writeEarthNav();

    await loadNavaids(root);
    const second = await loadNavaids(root);

    expect(second.fromCache).toBe(true);
    expect(second.count).toBe(1);
  });

  it('reloads when a user_nav.dat appears after a cached load', async () => {
    writeEarthNav();
    await loadNavaids(root);

    writeUserNav([USER_NAV_LINE], 1_000_000_100);
    const result = await loadNavaids(root);

    expect(result.fromCache).toBe(false);
    expect(result.count).toBe(2);
  });

  it('checkMergedNavValidity goes stale when a user_nav.dat appears — the startup fast path gate', async () => {
    writeEarthNav();
    await loadNavaids(root);
    expect(checkMergedNavValidity(root, 'navaids').needsReload).toBe(false);

    writeUserNav([USER_NAV_LINE], 1_000_000_100);
    expect(checkMergedNavValidity(root, 'navaids').needsReload).toBe(true);
  });

  it('reloads when user_nav.dat changes, and when it is deleted', async () => {
    writeEarthNav();
    writeUserNav([USER_NAV_LINE], 1_000_000_100);
    await loadNavaids(root);

    writeUserNav([USER_NAV_LINE, USER_NAV_LINE_2], 1_000_000_200);
    const changed = await loadNavaids(root);
    expect(changed.fromCache).toBe(false);
    expect(changed.count).toBe(3);

    fs.rmSync(path.join(root, 'Custom Data/user_nav.dat'));
    const removed = await loadNavaids(root);
    expect(removed.fromCache).toBe(false);
    expect(removed.count).toBe(1);
  });
});

describe('loadWaypoints with user_fix.dat', () => {
  beforeEach(async () => {
    await createTestDb();
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-navloader-'));
  });

  afterEach(() => {
    closeTestDb();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('merges user_fix.dat waypoints with earth_fix.dat', async () => {
    write('Resources/default data/earth_fix.dat', [EARTH_FIX_LINE], FIX_HEADER, 1_000_000_000);
    write('Custom Data/user_fix.dat', [USER_FIX_LINE], FIX_HEADER, 1_000_000_100);

    const result = await loadWaypoints(root);

    expect(result.count).toBe(2);
    const ids = getAllWaypointsFromDb().map((w) => w.id);
    expect(ids).toContain('0110W');
    expect(ids).toContain('MYFIX');
  });
});
