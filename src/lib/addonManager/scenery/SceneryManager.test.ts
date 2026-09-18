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
let iniPath: string;

/** Minimal folder that classifies as a real airport scenery. */
function makeAirport(dir: string): string {
  fs.mkdirSync(path.join(dir, 'Earth nav data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Earth nav data', 'apt.dat'), 'I\n1000 Version\n');
  return dir;
}

function writeIni(body: string): void {
  fs.writeFileSync(iniPath, body);
}

function readIniLines(): string[] {
  return fs.readFileSync(iniPath, 'utf-8').split(/\r?\n/);
}

beforeEach(() => {
  TMP_ROOT = path.join(os.tmpdir(), `xd-scenerymgr-${Date.now()}-${Math.random()}`);
  xpRoot = path.join(TMP_ROOT, 'X-Plane 12');
  customScenery = path.join(xpRoot, 'Custom Scenery');
  externalDrive = path.join(TMP_ROOT, 'D-drive', 'X-Plane Scenery');
  iniPath = path.join(customScenery, 'scenery_packs.ini');
  fs.mkdirSync(customScenery, { recursive: true });
  fs.mkdirSync(externalDrive, { recursive: true });
  // Required marker file so SceneryManager.analyze accepts an empty INI gracefully.
  writeIni('I\n1000 Version\nSCENERY\n\n');
});

afterEach(() => fs.rmSync(TMP_ROOT, { recursive: true, force: true }));

describe('SceneryManager — .lnk shortcut discovery', () => {
  it('treats Heathrow.lnk in Custom Scenery as if Heathrow lived there', async () => {
    const heathrowTarget = makeAirport(path.join(externalDrive, 'Heathrow'));

    fs.writeFileSync(
      path.join(customScenery, 'Heathrow.lnk'),
      buildMinimalLnk(heathrowTarget, 'ascii')
    );

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const heathrow = result.value.find((e) => e.displayName === 'Heathrow');
    expect(heathrow).toBeDefined();
    expect(heathrow!.fullPath).toBe(heathrowTarget);
    expect(heathrow!.shortcutPath).toBe(path.join(customScenery, 'Heathrow.lnk'));
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
    expect(result.value.find((e) => e.displayName === 'Phantom')).toBeUndefined();
  });

  it('does not duplicate when both Heathrow/ and Heathrow.lnk exist', async () => {
    const realHeathrow = makeAirport(path.join(customScenery, 'Heathrow'));

    const altTarget = path.join(externalDrive, 'Heathrow-alt');
    fs.mkdirSync(altTarget);
    fs.writeFileSync(path.join(customScenery, 'Heathrow.lnk'), buildMinimalLnk(altTarget, 'ascii'));

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const matches = result.value.filter((e) => e.displayName === 'Heathrow');
    expect(matches).toHaveLength(1);
    expect(matches[0]!.fullPath).toBe(realHeathrow);
  });

  it('classifies an INI entry that references a .lnk file using the target', async () => {
    const heathrowTarget = makeAirport(path.join(externalDrive, 'Heathrow-INI'));

    fs.writeFileSync(
      path.join(customScenery, 'Heathrow-INI.lnk'),
      buildMinimalLnk(heathrowTarget, 'ascii')
    );

    writeIni('I\n1000 Version\nSCENERY\n\nSCENERY_PACK Custom Scenery/Heathrow-INI.lnk/\n');

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Exactly one entry — the INI reference shouldn't be duplicated by the
    // dir-walk fallback finding the same .lnk file.
    const matches = result.value.filter((e) => e.displayName.startsWith('Heathrow-INI'));
    expect(matches).toHaveLength(1);
    const entry = matches[0]!;
    expect(entry.sceneryPath).toBe('Custom Scenery/Heathrow-INI.lnk'); // INI form wins
    expect(entry.classification.hasEarthNavData).toBe(true);
    expect(entry.classification.hasAptDat).toBe(true);
  });

  it('deletes the shortcut and leaves its target folder in place', async () => {
    const heathrowTarget = makeAirport(path.join(externalDrive, 'Heathrow'));
    const shortcut = path.join(customScenery, 'Heathrow.lnk');
    fs.writeFileSync(shortcut, buildMinimalLnk(heathrowTarget, 'ascii'));

    const mgr = new SceneryManager(xpRoot);
    const analyzed = await mgr.analyze();
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;
    const entry = analyzed.value.find((e) => e.displayName === 'Heathrow')!;

    const result = await mgr.deleteScenery(entry.sceneryPath);
    expect(result.ok).toBe(true);
    expect(fs.existsSync(shortcut)).toBe(false);
    expect(fs.existsSync(path.join(heathrowTarget, 'Earth nav data', 'apt.dat'))).toBe(true);
  });

  it('still picks up POSIX-symlinked scenery folders (junction regression)', async () => {
    if (process.platform === 'win32') return; // Node symlink creation on Windows requires admin; skip.
    const target = makeAirport(path.join(externalDrive, 'SymlinkTarget'));

    const linkPath = path.join(customScenery, 'SymlinkTarget');
    fs.symlinkSync(target, linkPath, 'dir');

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.analyze();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const entry = result.value.find((e) => e.displayName === 'SymlinkTarget');
    expect(entry).toBeDefined();
    expect(entry!.classification.hasAptDat).toBe(true);
  });
});

describe('SceneryManager — scenery_packs.ini round trip', () => {
  it('keeps the SCENERY header line that X-Plane writes', async () => {
    makeAirport(path.join(customScenery, 'EGLL'));
    writeIni('I\n1000 Version\nSCENERY\n\nSCENERY_PACK Custom Scenery/EGLL/\n');

    const mgr = new SceneryManager(xpRoot);
    const result = await mgr.toggle('Custom Scenery/EGLL');
    expect(result.ok).toBe(true);

    const lines = readIniLines();
    expect(lines[0]).toBe('I');
    expect(lines[1]).toBe('1000 Version');
    expect(lines[2]).toBe('SCENERY');
    expect(lines).toContain('SCENERY_PACK_DISABLED Custom Scenery/EGLL/');
  });

  it('restores a SCENERY line an earlier write dropped', async () => {
    makeAirport(path.join(customScenery, 'EGLL'));
    writeIni('I\n1000 Version\n\nSCENERY_PACK Custom Scenery/EGLL/\n');

    const mgr = new SceneryManager(xpRoot);
    await mgr.toggle('Custom Scenery/EGLL');

    expect(readIniLines()).toContain('SCENERY');
  });

  it('keeps nested scenery paths instead of flattening them to a folder name', async () => {
    const nested = 'Custom Scenery/ortho/zOrtho4XP_+50+000';
    makeAirport(path.join(xpRoot, ...nested.split('/')));
    writeIni(`I\n1000 Version\nSCENERY\n\nSCENERY_PACK ${nested}/\n`);

    const mgr = new SceneryManager(xpRoot);
    const analyzed = await mgr.analyze();
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;

    const entry = analyzed.value.find((e) => e.sceneryPath === nested);
    expect(entry).toBeDefined();
    expect(entry!.displayName).toBe('zOrtho4XP_+50+000');
    // The parent folder is a container, not a pack of its own.
    expect(analyzed.value.find((e) => e.sceneryPath === 'Custom Scenery/ortho')).toBeUndefined();

    const toggled = await mgr.toggle(nested);
    expect(toggled.ok).toBe(true);
    expect(readIniLines()).toContain(`SCENERY_PACK_DISABLED ${nested}/`);
  });

  it('keeps an entry whose folder is gone instead of dropping the line', async () => {
    makeAirport(path.join(customScenery, 'EGLL'));
    writeIni(
      'I\n1000 Version\nSCENERY\n\nSCENERY_PACK Custom Scenery/Unplugged/\nSCENERY_PACK Custom Scenery/EGLL/\n'
    );

    const mgr = new SceneryManager(xpRoot);
    const analyzed = await mgr.analyze();
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;

    const gone = analyzed.value.find((e) => e.sceneryPath === 'Custom Scenery/Unplugged');
    expect(gone?.missing).toBe(true);

    await mgr.toggle('Custom Scenery/EGLL');
    expect(readIniLines()).toContain('SCENERY_PACK Custom Scenery/Unplugged/');
  });

  it('keeps an absolute external path exactly as written', async () => {
    const external = makeAirport(path.join(externalDrive, 'LOWI'));
    const iniForm = external.replace(/\\/g, '/');
    makeAirport(path.join(customScenery, 'EGLL'));
    writeIni(
      `I\n1000 Version\nSCENERY\n\nSCENERY_PACK ${iniForm}/\nSCENERY_PACK Custom Scenery/EGLL/\n`
    );

    const mgr = new SceneryManager(xpRoot);
    await mgr.toggle('Custom Scenery/EGLL');

    expect(readIniLines()).toContain(`SCENERY_PACK ${iniForm}/`);
  });

  it('preserves CRLF line endings', async () => {
    makeAirport(path.join(customScenery, 'EGLL'));
    writeIni('I\r\n1000 Version\r\nSCENERY\r\n\r\nSCENERY_PACK Custom Scenery/EGLL/\r\n');

    const mgr = new SceneryManager(xpRoot);
    await mgr.toggle('Custom Scenery/EGLL');

    const raw = fs.readFileSync(iniPath, 'utf-8');
    expect(raw.includes('\r\n')).toBe(true);
    expect(raw.split('\r\n').join('')).not.toContain('\n');
  });

  it('writes a backup before every save', async () => {
    makeAirport(path.join(customScenery, 'EGLL'));
    writeIni('I\n1000 Version\nSCENERY\n\nSCENERY_PACK Custom Scenery/EGLL/\n');

    const mgr = new SceneryManager(xpRoot);
    await mgr.toggle('Custom Scenery/EGLL');

    const backups = await mgr.listBackups();
    expect(backups.length).toBe(1);
    expect(fs.readFileSync(backups[0]!.path, 'utf-8')).toContain(
      'SCENERY_PACK Custom Scenery/EGLL/'
    );
  });

  it('adds folders the INI does not list yet only once the user saves', async () => {
    makeAirport(path.join(customScenery, 'EGLL'));
    makeAirport(path.join(customScenery, 'LFPG'));
    writeIni('I\n1000 Version\nSCENERY\n\nSCENERY_PACK Custom Scenery/EGLL/\n');

    const mgr = new SceneryManager(xpRoot);
    const analyzed = await mgr.analyze();
    expect(analyzed.ok).toBe(true);
    if (!analyzed.ok) return;

    // analyze() surfaces it but must not touch the file
    expect(analyzed.value.map((e) => e.sceneryPath)).toContain('Custom Scenery/LFPG');
    expect(readIniLines()).not.toContain('SCENERY_PACK Custom Scenery/LFPG/');
  });
});
