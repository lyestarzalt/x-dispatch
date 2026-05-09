import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildMinimalLnk } from '@/lib/utils/buildLnkFixture';

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

const { SceneryManager } = await import('./SceneryManager');

let TMP_ROOT: string;
let xpRoot: string;
let customScenery: string;
let externalDrive: string;

beforeEach(() => {
  TMP_ROOT = path.join(os.tmpdir(), `xd-scenerymgr-${Date.now()}-${Math.random()}`);
  xpRoot = path.join(TMP_ROOT, 'X-Plane 12');
  customScenery = path.join(xpRoot, 'Custom Scenery');
  externalDrive = path.join(TMP_ROOT, 'D-drive', 'X-Plane Scenery');
  fs.mkdirSync(customScenery, { recursive: true });
  fs.mkdirSync(externalDrive, { recursive: true });
  // Required marker file so SceneryManager.analyze accepts an empty INI gracefully.
  fs.writeFileSync(path.join(customScenery, 'scenery_packs.ini'), 'I\n1000 Version\n');
});

afterEach(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

describe('SceneryManager — .lnk shortcut discovery', () => {
  it('treats Heathrow.lnk in Custom Scenery as if Heathrow lived there', async () => {
    // External target folder with a marker so it classifies as a real scenery
    const heathrowTarget = path.join(externalDrive, 'Heathrow');
    fs.mkdirSync(heathrowTarget);
    fs.mkdirSync(path.join(heathrowTarget, 'Earth nav data'));
    fs.writeFileSync(path.join(heathrowTarget, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');

    // Shortcut points at heathrowTarget
    fs.writeFileSync(
      path.join(customScenery, 'Heathrow.lnk'),
      buildMinimalLnk(heathrowTarget, 'ascii')
    );

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const heathrow = result.value.find((e) => e.folderName === 'Heathrow');
    expect(heathrow).toBeDefined();
    expect(heathrow!.fullPath).toBe(heathrowTarget);
    expect(heathrow!.classification.hasEarthNavData).toBe(true);
    expect(heathrow!.classification.hasAptDat).toBe(true);
  });

  it('skips a .lnk whose target does not exist', async () => {
    fs.writeFileSync(
      path.join(customScenery, 'Phantom.lnk'),
      buildMinimalLnk(path.join(externalDrive, 'never-existed'), 'ascii')
    );

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.find((e) => e.folderName === 'Phantom')).toBeUndefined();
  });

  it('does not duplicate when both Heathrow/ and Heathrow.lnk exist', async () => {
    const realHeathrow = path.join(customScenery, 'Heathrow');
    fs.mkdirSync(realHeathrow);
    fs.mkdirSync(path.join(realHeathrow, 'Earth nav data'));
    fs.writeFileSync(path.join(realHeathrow, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');

    const altTarget = path.join(externalDrive, 'Heathrow-alt');
    fs.mkdirSync(altTarget);
    fs.writeFileSync(path.join(customScenery, 'Heathrow.lnk'), buildMinimalLnk(altTarget, 'ascii'));

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const matches = result.value.filter((e) => e.folderName === 'Heathrow');
    expect(matches).toHaveLength(1);
    // The real folder wins (processed first by the loop)
    expect(matches[0]!.fullPath).toBe(realHeathrow);
  });

  it('classifies an INI entry that references a .lnk file using the target', async () => {
    const heathrowTarget = path.join(externalDrive, 'Heathrow-INI');
    fs.mkdirSync(heathrowTarget);
    fs.mkdirSync(path.join(heathrowTarget, 'Earth nav data'));
    fs.writeFileSync(path.join(heathrowTarget, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');

    fs.writeFileSync(
      path.join(customScenery, 'Heathrow-INI.lnk'),
      buildMinimalLnk(heathrowTarget, 'ascii')
    );

    // Reference the .lnk directly from scenery_packs.ini
    fs.writeFileSync(
      path.join(customScenery, 'scenery_packs.ini'),
      'I\n1000 Version\nSCENERY_PACK Custom Scenery/Heathrow-INI.lnk/\n'
    );

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Exactly one entry — the INI reference shouldn't be duplicated by the
    // dir-walk fallback finding the same .lnk file.
    const matches = result.value.filter(
      (e) => e.folderName === 'Heathrow-INI.lnk' || e.folderName === 'Heathrow-INI'
    );
    expect(matches).toHaveLength(1);
    const entry = matches[0]!;
    expect(entry.folderName).toBe('Heathrow-INI.lnk'); // INI form wins
    // Classification used the resolved target, not the .lnk file
    expect(entry.classification.hasEarthNavData).toBe(true);
    expect(entry.classification.hasAptDat).toBe(true);
  });

  it('still picks up POSIX-symlinked scenery folders (junction regression)', async () => {
    if (process.platform === 'win32') return; // Node symlink creation on Windows requires admin; skip.
    const target = path.join(externalDrive, 'SymlinkTarget');
    fs.mkdirSync(target);
    fs.mkdirSync(path.join(target, 'Earth nav data'));
    fs.writeFileSync(path.join(target, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');

    const linkPath = path.join(customScenery, 'SymlinkTarget');
    fs.symlinkSync(target, linkPath, 'dir');

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.value.find((e) => e.folderName === 'SymlinkTarget');
    expect(entry).toBeDefined();
    expect(entry!.classification.hasAptDat).toBe(true);
  });
});
