import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMinimalLnk } from '@/lib/utils/buildLnkFixture';

// The airport cache reaches Electron through the database path; the real
// package downloads its binary on first require.
vi.mock('electron', () => ({
  app: { isPackaged: false, getPath: () => '/tmp' },
}));

// Mock logger before import — see SceneryManager.test.ts for pattern.
vi.mock('@/lib/utils/logger', () => ({
  default: {
    main: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    data: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    ipc: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    security: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    launcher: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    tracker: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    addon: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// The real fs, with the blocking calls the scan must not make counted.
const { SYNC_CALLS } = vi.hoisted(() => ({
  SYNC_CALLS: ['readdirSync', 'statSync', 'existsSync', 'readFileSync'] as const,
}));
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  const counted = Object.fromEntries(
    SYNC_CALLS.map((name) => [name, vi.fn(actual[name] as (...args: unknown[]) => unknown)])
  );
  return { ...actual, ...counted, default: { ...actual, ...counted } };
});

const { findCustomSceneryAptFiles, getCustomSceneryFileInfos, skippedSummary } =
  await import('./customSceneryLoader');

let TMP_ROOT: string;
let xpRoot: string;
let customScenery: string;
let externalDrive: string;

beforeEach(() => {
  TMP_ROOT = path.join(os.tmpdir(), `xd-customloader-${Date.now()}-${Math.random()}`);
  xpRoot = path.join(TMP_ROOT, 'X-Plane 12');
  customScenery = path.join(xpRoot, 'Custom Scenery');
  externalDrive = path.join(TMP_ROOT, 'D-drive', 'Scenery');
  fs.mkdirSync(customScenery, { recursive: true });
  fs.mkdirSync(externalDrive, { recursive: true });
});

afterEach(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

describe('findCustomSceneryAptFiles', () => {
  it('finds apt.dat reachable via a .lnk shortcut', async () => {
    const target = path.join(externalDrive, 'Heathrow');
    fs.mkdirSync(target);
    fs.mkdirSync(path.join(target, 'Earth nav data'));
    const aptPath = path.join(target, 'Earth nav data', 'apt.dat');
    fs.writeFileSync(aptPath, 'I\n1000 Version\n');

    fs.writeFileSync(path.join(customScenery, 'Heathrow.lnk'), buildMinimalLnk(target, 'ascii'));

    const found = await findCustomSceneryAptFiles(xpRoot);
    expect(found).toContain(aptPath);
  });

  it('skips a .lnk pointing at a missing target without throwing', async () => {
    fs.writeFileSync(
      path.join(customScenery, 'Phantom.lnk'),
      buildMinimalLnk(path.join(externalDrive, 'never-existed'), 'ascii')
    );

    await expect(findCustomSceneryAptFiles(xpRoot)).resolves.toBeDefined();
    expect(await findCustomSceneryAptFiles(xpRoot)).toEqual([]);
  });

  it('still finds apt.dat in real folders alongside .lnk shortcuts', async () => {
    // Real folder
    const realPath = path.join(customScenery, 'RealField');
    fs.mkdirSync(path.join(realPath, 'Earth nav data'), { recursive: true });
    const realAptPath = path.join(realPath, 'Earth nav data', 'apt.dat');
    fs.writeFileSync(realAptPath, 'I\n1000 Version\n');

    // Shortcut to external drive
    const linkedTarget = path.join(externalDrive, 'LinkedField');
    fs.mkdirSync(path.join(linkedTarget, 'Earth nav data'), { recursive: true });
    const linkedAptPath = path.join(linkedTarget, 'Earth nav data', 'apt.dat');
    fs.writeFileSync(linkedAptPath, 'I\n1000 Version\n');
    fs.writeFileSync(
      path.join(customScenery, 'LinkedField.lnk'),
      buildMinimalLnk(linkedTarget, 'ascii')
    );

    const found = await findCustomSceneryAptFiles(xpRoot);
    expect(found.sort()).toEqual([realAptPath, linkedAptPath].sort());
  });

  it('still finds apt.dat through a POSIX symlink (junction regression)', async () => {
    if (process.platform === 'win32') return;
    const target = path.join(externalDrive, 'SymlinkTarget');
    fs.mkdirSync(path.join(target, 'Earth nav data'), { recursive: true });
    fs.writeFileSync(path.join(target, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');

    const linkPath = path.join(customScenery, 'SymlinkTarget');
    fs.symlinkSync(target, linkPath, 'dir');

    // Function returns the path through the symlink, not the resolved target
    const expectedPath = path.join(linkPath, 'Earth nav data', 'apt.dat');
    expect(await findCustomSceneryAptFiles(xpRoot)).toContain(expectedPath);
  });

  // ── Regression for v1.8 .lnk dedup bug (reported on v1.8.0) ──────────
  // Two filesystem entries resolving to the same physical apt.dat used to
  // produce duplicate entries in the returned list, which then tripped
  // the `apt_file_meta.path` PRIMARY KEY when the loader pipeline
  // persisted them. The walker now dedupes by canonical path.

  it('dedupes when a .lnk inside Custom Scenery points at a sibling real directory', async () => {
    // Real subdir: Custom Scenery/KLAX/Earth nav data/apt.dat
    const realDir = path.join(customScenery, 'KLAX');
    fs.mkdirSync(path.join(realDir, 'Earth nav data'), { recursive: true });
    const aptPath = path.join(realDir, 'Earth nav data', 'apt.dat');
    fs.writeFileSync(aptPath, 'I\n1000 Version\n');

    // Shortcut pointing at that real subdir — the resolved target's
    // apt.dat is the same file as the one discovered via the dir scan.
    fs.writeFileSync(
      path.join(customScenery, 'KLAX-shortcut.lnk'),
      buildMinimalLnk(realDir, 'ascii')
    );

    const found = await findCustomSceneryAptFiles(xpRoot);
    expect(found.filter((p) => p === path.resolve(aptPath))).toHaveLength(1);
  });

  it('dedupes when two .lnk shortcuts resolve to the same external folder', async () => {
    const target = path.join(externalDrive, 'SharedKLAX');
    fs.mkdirSync(path.join(target, 'Earth nav data'), { recursive: true });
    const aptPath = path.join(target, 'Earth nav data', 'apt.dat');
    fs.writeFileSync(aptPath, 'I\n1000 Version\n');

    // Two distinct .lnk filenames, identical target.
    fs.writeFileSync(path.join(customScenery, 'A.lnk'), buildMinimalLnk(target, 'ascii'));
    fs.writeFileSync(path.join(customScenery, 'B.lnk'), buildMinimalLnk(target, 'ascii'));

    const found = await findCustomSceneryAptFiles(xpRoot);
    expect(found.filter((p) => p === path.resolve(aptPath))).toHaveLength(1);
  });

  // It runs on every start, before the cache check. Synchronous calls held the
  // main process past ten seconds on big or slow Custom Scenery folders.
  it('scans without synchronous filesystem calls', async () => {
    const realDir = path.join(customScenery, 'KSEA');
    fs.mkdirSync(path.join(realDir, 'Earth nav data'), { recursive: true });
    fs.writeFileSync(path.join(realDir, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');
    const target = path.join(externalDrive, 'KPDX');
    fs.mkdirSync(path.join(target, 'Earth nav data'), { recursive: true });
    fs.writeFileSync(path.join(target, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');
    fs.writeFileSync(path.join(customScenery, 'KPDX.lnk'), buildMinimalLnk(target, 'ascii'));

    for (const name of SYNC_CALLS) vi.mocked(fs[name]).mockClear();

    const infos = await getCustomSceneryFileInfos(xpRoot);

    expect(infos).toHaveLength(2);
    for (const name of SYNC_CALLS) expect(fs[name], name).not.toHaveBeenCalled();
  });
});

describe('skippedSummary', () => {
  it('counts skipped entries by cause in one line', () => {
    expect(
      skippedSummary([
        { name: 'XPME_Europe.lnk', why: 'shortcut parse-error: bad header' },
        { name: 'XPME_Asia.lnk', why: 'shortcut parse-error: bad header' },
        { name: 'Orbx_A_LOWI', why: 'unreadable or broken link' },
      ])
    ).toBe(
      'Custom Scenery: 3 entries skipped (2 shortcut parse-error: bad header, 1 unreadable or broken link)'
    );
  });

  it('says nothing when every entry was read', () => {
    expect(skippedSummary([])).toBeNull();
  });
});
