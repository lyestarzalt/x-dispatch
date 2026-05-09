import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMinimalLnk } from '@/lib/utils/buildLnkFixture';

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

const { findCustomSceneryAptFiles } = await import('./customSceneryLoader');

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
  it('finds apt.dat reachable via a .lnk shortcut', () => {
    const target = path.join(externalDrive, 'Heathrow');
    fs.mkdirSync(target);
    fs.mkdirSync(path.join(target, 'Earth nav data'));
    const aptPath = path.join(target, 'Earth nav data', 'apt.dat');
    fs.writeFileSync(aptPath, 'I\n1000 Version\n');

    fs.writeFileSync(path.join(customScenery, 'Heathrow.lnk'), buildMinimalLnk(target, 'ascii'));

    const found = findCustomSceneryAptFiles(xpRoot);
    expect(found).toContain(aptPath);
  });

  it('skips a .lnk pointing at a missing target without throwing', () => {
    fs.writeFileSync(
      path.join(customScenery, 'Phantom.lnk'),
      buildMinimalLnk(path.join(externalDrive, 'never-existed'), 'ascii')
    );

    expect(() => findCustomSceneryAptFiles(xpRoot)).not.toThrow();
    expect(findCustomSceneryAptFiles(xpRoot)).toEqual([]);
  });

  it('still finds apt.dat in real folders alongside .lnk shortcuts', () => {
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

    const found = findCustomSceneryAptFiles(xpRoot);
    expect(found.sort()).toEqual([realAptPath, linkedAptPath].sort());
  });

  it('still finds apt.dat through a POSIX symlink (junction regression)', () => {
    if (process.platform === 'win32') return;
    const target = path.join(externalDrive, 'SymlinkTarget');
    fs.mkdirSync(path.join(target, 'Earth nav data'), { recursive: true });
    fs.writeFileSync(path.join(target, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');

    const linkPath = path.join(customScenery, 'SymlinkTarget');
    fs.symlinkSync(target, linkPath, 'dir');

    // Function returns the path through the symlink, not the resolved target
    const expectedPath = path.join(linkPath, 'Earth nav data', 'apt.dat');
    expect(findCustomSceneryAptFiles(xpRoot)).toContain(expectedPath);
  });
});
