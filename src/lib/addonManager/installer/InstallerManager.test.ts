import { execFileSync } from 'child_process';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDsf } from '../core/dsfFixture';
import { InstallerManager } from './InstallerManager';

vi.mock('@/lib/utils/logger', () => {
  const scope = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { default: { addon: scope, security: scope } };
});

let dir: string;
let xplane: string;

/** The 7-Zip we ship makes every fixture: zip, 7z, encrypted, split. */
async function sevenZip(): Promise<string> {
  const { path7za } = await import('7zip-bin');
  return path7za;
}

/** Write `files` (archive path → content) under `root` and return the folder. */
function tree(root: string, files: Record<string, string>): string {
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  return root;
}

async function archive(
  name: string,
  files: Record<string, string>,
  extra: string[] = []
): Promise<string> {
  const src = tree(fs.mkdtempSync(path.join(dir, 'src-')), files);
  const out = path.join(dir, name);
  execFileSync(await sevenZip(), ['a', '-y', ...extra, out, '.'], { cwd: src, stdio: 'ignore' });
  return out;
}

function readTree(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const walk = (current: string, rel: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full, childRel);
      else result[childRel] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(root, '');
  return result;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-installer-'));
  xplane = path.join(dir, 'X-Plane 12');
  fs.mkdirSync(xplane);
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

async function installFirst(manager: InstallerManager, filePath: string, passwords = {}) {
  const analyzed = await manager.analyze([filePath], passwords);
  expect(analyzed.ok).toBe(true);
  if (!analyzed.ok) throw new Error(analyzed.error.code);
  const item = analyzed.value[0];
  expect(item).toBeDefined();
  if (!item) throw new Error('nothing detected');
  const [task] = manager.prepareInstallTasks([item]);
  if (!task) throw new Error('no task');
  const installed = await manager.install([task]);
  expect(installed.ok).toBe(true);
  if (!installed.ok) throw new Error(installed.error.code);
  return { item, task, result: installed.value[0] };
}

describe('InstallerManager.analyze', () => {
  it('reports a file that is not an archive as not an archive', async () => {
    const file = path.join(dir, 'setup.exe');
    fs.writeFileSync(file, 'MZ');
    const result = await new InstallerManager(xplane).analyze([file]);
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_ARCHIVE', path: file, folder: false },
    });
  });

  it('keeps the error code for an archive that cannot be read', async () => {
    const file = path.join(dir, 'broken.zip');
    fs.writeFileSync(file, 'not a zip');
    const result = await new InstallerManager(xplane).analyze([file]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(typeof result.error.code).toBe('string');
  });

  it('installs an aircraft from a zip', async () => {
    const zip = await archive('Bird.zip', {
      'Bird/bird.acf': 'acf',
      'Bird/objects/wing.obj': 'obj',
      'Bird/skunkcrafts_updater.cfg': 'module|Bird\nversion|2.4.1\n',
      '__MACOSX/Bird/._bird.acf': 'junk',
    });
    const { item, result } = await installFirst(new InstallerManager(xplane), zip);
    expect(item.addonType).toBe('Aircraft');
    expect(item.versionInfo).toEqual({ version: '2.4.1', source: 'skunkcrafts_updater.cfg' });
    expect(result?.success).toBe(true);
    expect(readTree(path.join(xplane, 'Aircraft', 'Bird'))).toEqual({
      'bird.acf': 'acf',
      'objects/wing.obj': 'obj',
      'skunkcrafts_updater.cfg': 'module|Bird\nversion|2.4.1\n',
    });
  });

  it('installs a plugin from a 7z, stripping the add-on folder', async () => {
    const seven = await archive('Plug.7z', {
      'MyPlugin/64/win.xpl': 'xpl',
      'MyPlugin/readme.txt': 'hi',
    });
    const { item } = await installFirst(new InstallerManager(xplane), seven);
    expect(item.addonType).toBe('Plugin');
    expect(readTree(path.join(xplane, 'Resources', 'plugins', 'MyPlugin'))).toEqual({
      '64/win.xpl': 'xpl',
      'readme.txt': 'hi',
    });
  });

  it('installs from a dropped folder', async () => {
    const folder = tree(path.join(dir, 'KSEA Seattle'), {
      'Earth nav data/+40-130/+47-123.dsf': 'dsf',
      'Earth nav data/apt.dat': 'apt',
      'library.txt': 'lib',
    });
    const { item } = await installFirst(new InstallerManager(xplane), folder);
    expect(item.addonType).toBe('Scenery');
    expect(item.archiveFormat).toBe('folder');
    expect(readTree(path.join(xplane, 'Custom Scenery', 'KSEA Seattle'))).toEqual({
      'Earth nav data/+40-130/+47-123.dsf': 'dsf',
      'Earth nav data/apt.dat': 'apt',
      'library.txt': 'lib',
    });
  });

  it('finds the add-on inside a nested archive and installs it', async () => {
    const inner = await archive('A330.7z', { 'A330/a330.acf': 'acf' });
    const outer = await archive('Download.zip', {
      'readme.txt': 'extract the 7z',
      'A330.7z': fs.readFileSync(inner, 'latin1'),
    });
    // the zip must hold the real 7z bytes, not a latin1 round trip
    const manager = new InstallerManager(xplane);
    const src = fs.mkdtempSync(path.join(dir, 'nested-'));
    fs.copyFileSync(inner, path.join(src, 'A330.7z'));
    fs.writeFileSync(path.join(src, 'readme.txt'), 'extract the 7z');
    execFileSync(await sevenZip(), ['a', '-y', outer, '.'], { cwd: src, stdio: 'ignore' });

    const { item } = await installFirst(manager, outer);
    expect(item.addonType).toBe('Aircraft');
    expect(item.extractionChain).toEqual([{ entryPath: 'A330.7z' }]);
    expect(item.warnings).toEqual([{ code: 'NESTED_ARCHIVE', params: { name: 'A330.7z' } }]);
    expect(readTree(path.join(xplane, 'Aircraft', 'A330'))).toEqual({ 'a330.acf': 'acf' });
  });

  it('asks for a password, rejects a wrong one, and installs with the right one', async () => {
    const zip = await archive('Secret.zip', { 'Plane/plane.acf': 'acf' }, ['-phunter2']);
    const manager = new InstallerManager(xplane);

    const noPassword = await manager.analyze([zip]);
    expect(noPassword).toEqual({ ok: false, error: { code: 'PASSWORD_REQUIRED', path: zip } });

    const wrong = await manager.analyze([zip], { [zip]: 'nope' });
    expect(wrong).toEqual({ ok: false, error: { code: 'INVALID_PASSWORD', path: zip } });

    const { item } = await installFirst(manager, zip, { [zip]: 'hunter2' });
    expect(item.password).toBe('hunter2');
    expect(readTree(path.join(xplane, 'Aircraft', 'Plane'))).toEqual({ 'plane.acf': 'acf' });
  });

  it('asks for a password when a 7z hides its file names', async () => {
    const seven = await archive('Hidden.7z', { 'Plane/plane.acf': 'acf' }, [
      '-phunter2',
      '-mhe=on',
    ]);
    const manager = new InstallerManager(xplane);
    const noPassword = await manager.analyze([seven]);
    expect(noPassword).toEqual({ ok: false, error: { code: 'PASSWORD_REQUIRED', path: seven } });
    const { item } = await installFirst(manager, seven, { [seven]: 'hunter2' });
    expect(item.addonType).toBe('Aircraft');
  });

  it('opens a split 7z from any of its volumes and names a missing one', async () => {
    const big = 'x'.repeat(40_000);
    const first = await archive('Big.7z', { 'Big/big.acf': big }, ['-v10k', '-mx0']);
    expect(fs.existsSync(`${first}.002`)).toBe(true);
    const manager = new InstallerManager(xplane);

    const fromSecond = await manager.analyze([`${first}.002`]);
    expect(fromSecond.ok).toBe(true);
    if (fromSecond.ok) expect(fromSecond.value[0]?.addonType).toBe('Aircraft');

    const { item } = await installFirst(manager, `${first}.001`);
    expect(item.displayName).toBe('Big');
    expect(readTree(path.join(xplane, 'Aircraft', 'Big'))['big.acf']).toBe(big);

    fs.rmSync(`${first}.002`);
    const missing = await manager.analyze([`${first}.001`]);
    expect(missing).toEqual({
      ok: false,
      error: { code: 'MISSING_VOLUME', path: `${first}.001`, missing: 'Big.7z.002' },
    });
  });

  it('recognises a livery and installs it into the matching aircraft', async () => {
    tree(path.join(xplane, 'Aircraft', 'Laminar', 'Cessna 172'), { 'Cessna_172SP.acf': 'acf' });
    const zip = await archive('N12345.zip', {
      'N12345/Cessna_172SP_icon11.png': 'png',
      'N12345/objects/fuselage.png': 'tex',
    });
    const { item, task } = await installFirst(new InstallerManager(xplane), zip);
    expect(item.addonType).toBe('Livery');
    expect(item.liveryInfo).toEqual({
      aircraftTypeId: 'acf:Cessna_172SP',
      aircraftName: 'Cessna_172SP',
    });
    expect(task.warnings).toEqual([]);
    expect(
      readTree(path.join(xplane, 'Aircraft', 'Laminar', 'Cessna 172', 'liveries', 'N12345'))
    ).toEqual({ 'Cessna_172SP_icon11.png': 'png', 'objects/fuselage.png': 'tex' });
  });

  it('warns when the livery’s aircraft is not installed', async () => {
    const zip = await archive('KLM.zip', { 'KLM/objects/fuselage320_1.dds': 'tex' });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip]);
    if (!analyzed.ok || !analyzed.value[0]) throw new Error('nothing detected');
    const [task] = manager.prepareInstallTasks([analyzed.value[0]]);
    expect(task?.warnings).toEqual([
      { code: 'AIRCRAFT_NOT_FOUND', params: { aircraft: 'ToLiss A320' } },
    ]);
  });

  it('reads cycle.json and routes navdata by provider', async () => {
    const zip = await archive('Navdata.zip', {
      'GNS430/navdata/cycle.json': JSON.stringify({
        name: 'X-Plane GNS430',
        cycle: 2411,
        revision: 1,
      }),
      'GNS430/navdata/ATS.txt': 'ats',
    });
    const manager = new InstallerManager(xplane);
    const { item, task } = await installFirst(manager, zip);
    expect(item.addonType).toBe('Navdata');
    expect(item.navdataInfo).toEqual({ name: 'X-Plane GNS430', cycle: '2411', revision: '1' });
    expect(task.targetPath).toBe(path.join(xplane, 'Custom Data', 'GNS430'));
    expect(readTree(task.targetPath)).toEqual({
      'navdata/cycle.json': JSON.stringify({ name: 'X-Plane GNS430', cycle: 2411, revision: 1 }),
      'navdata/ATS.txt': 'ats',
    });
  });

  it('opens an archive whose extension lies about its format', async () => {
    const seven = await archive('Real7z.zip', { 'Plug/plug.xpl': 'xpl' }, ['-t7z']);
    const { item } = await installFirst(new InstallerManager(xplane), seven);
    expect(item.addonType).toBe('Plugin');
    expect(item.archiveFormat).toBe('7z');
  });

  it('shows what an install replaces: the installed version and navdata cycle', async () => {
    tree(path.join(xplane, 'Aircraft', 'Bird'), { 'bird.acf': 'old', 'version.txt': '1.0.0\n' });
    tree(path.join(xplane, 'Custom Data'), {
      'cycle.json': JSON.stringify({ name: 'X-Plane 12', cycle: '2410' }),
    });
    const zip = await archive('Bird.zip', {
      'Bird/bird.acf': 'new',
      'Bird/version.txt': '2.0.0\n',
    });
    const nav = await archive('Nav.zip', {
      'cycle.json': JSON.stringify({ name: 'X-Plane 12', cycle: '2411' }),
    });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip, nav]);
    if (!analyzed.ok) throw new Error(analyzed.error.code);
    const [bird, navdata] = manager.prepareInstallTasks(analyzed.value);
    expect(bird).toMatchObject({
      conflictExists: true,
      existingVersion: '1.0.0',
      installMode: 'overwrite',
    });
    expect(bird?.versionInfo?.version).toBe('2.0.0');
    expect(navdata).toMatchObject({
      conflictExists: true,
      existingNavdata: { name: 'X-Plane 12', cycle: '2410' },
    });
  });

  it('clean-installs an aircraft and puts its liveries and settings back', async () => {
    tree(path.join(xplane, 'Aircraft', 'Bird'), {
      'bird.acf': 'old',
      'stale.obj': 'gone',
      'Bird_prefs.txt': 'my settings',
      'liveries/Old/wing.png': 'png',
      'liveries/Shipped/wing.png': 'old shipped',
    });
    const zip = await archive('Bird.zip', {
      'Bird/bird.acf': 'new',
      'Bird/liveries/Shipped/wing.png': 'new shipped',
    });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip]);
    if (!analyzed.ok || !analyzed.value[0]) throw new Error('nothing detected');
    const [task] = manager.prepareInstallTasks([analyzed.value[0]]);
    if (!task) throw new Error('no task');
    task.installMode = 'clean';
    const installed = await manager.install([task]);
    if (!installed.ok) throw new Error(installed.error.code);
    const result = installed.value[0];
    expect(result?.success).toBe(true);
    expect(result?.backupPath).toMatch(/Bird\.backup_\d+$/);
    expect(readTree(path.join(xplane, 'Aircraft', 'Bird'))).toEqual({
      'bird.acf': 'new',
      'Bird_prefs.txt': 'my settings',
      'liveries/Old/wing.png': 'png',
      'liveries/Shipped/wing.png': 'new shipped',
    });
    expect(readTree(result?.backupPath ?? '')).toEqual({
      'Bird_prefs.txt': 'my settings',
      'liveries/Old/wing.png': 'png',
      'liveries/Shipped/wing.png': 'old shipped',
    });
  });

  it('clean-installs navdata without touching other providers in Custom Data', async () => {
    tree(path.join(xplane, 'Custom Data'), {
      'cycle.json': JSON.stringify({ name: 'X-Plane 12', cycle: '2410' }),
      'earth_nav.dat': 'old nav',
      'GNS430/navdata/cycle.json': 'other provider',
    });
    const zip = await archive('Nav.zip', {
      'cycle.json': JSON.stringify({ name: 'X-Plane 12', cycle: '2411' }),
      'earth_nav.dat': 'new nav',
    });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip]);
    if (!analyzed.ok || !analyzed.value[0]) throw new Error('nothing detected');
    const [task] = manager.prepareInstallTasks([analyzed.value[0]]);
    if (!task) throw new Error('no task');
    task.installMode = 'clean';
    const installed = await manager.install([task]);
    if (!installed.ok) throw new Error(installed.error.code);
    const result = installed.value[0];
    expect(result?.success).toBe(true);
    expect(readTree(path.join(xplane, 'Custom Data'))).toEqual({
      'cycle.json': JSON.stringify({ name: 'X-Plane 12', cycle: '2411' }),
      'earth_nav.dat': 'new nav',
      'GNS430/navdata/cycle.json': 'other provider',
    });
    expect(readTree(result?.backupPath ?? '')).toEqual({
      'cycle.json': JSON.stringify({ name: 'X-Plane 12', cycle: '2410' }),
      'earth_nav.dat': 'old nav',
    });
  });

  it('installs a byte-split zip from its volumes without joining them', async () => {
    const big = 'y'.repeat(40_000);
    const first = await archive('Split.zip', { 'Split/split.acf': big }, [
      '-v10k',
      '-tzip',
      '-mx0',
    ]);
    expect(fs.existsSync(`${first}.003`)).toBe(true);
    const manager = new InstallerManager(xplane);
    const { item } = await installFirst(manager, `${first}.002`);
    expect(item.addonType).toBe('Aircraft');
    expect(item.displayName).toBe('Split');
    expect(readTree(path.join(xplane, 'Aircraft', 'Split'))['split.acf']).toBe(big);
  });

  it('installs an encrypted byte-split zip', async () => {
    const big = 'z'.repeat(40_000);
    const first = await archive('Vault.zip', { 'Vault/vault.acf': big }, [
      '-v10k',
      '-tzip',
      '-mx0',
      '-pletmein',
    ]);
    const manager = new InstallerManager(xplane);
    const noPassword = await manager.analyze([`${first}.001`]);
    expect(noPassword).toEqual({
      ok: false,
      error: { code: 'PASSWORD_REQUIRED', path: `${first}.001` },
    });
    await installFirst(manager, `${first}.001`, { [`${first}.001`]: 'letmein' });
    expect(readTree(path.join(xplane, 'Aircraft', 'Vault'))['vault.acf']).toBe(big);
  });

  it('keeps an aircraft an aircraft when a livery icon sits at the archive root', async () => {
    const zip = await archive('Bird.zip', { 'Bird_icon11.png': 'png', 'Bird/bird.acf': 'acf' });
    const analyzed = await new InstallerManager(xplane).analyze([zip]);
    if (!analyzed.ok) throw new Error(analyzed.error.code);
    expect(analyzed.value.map((i) => i.addonType)).toEqual(['Aircraft']);
  });

  it('never rolls back a config file the new version ships', async () => {
    tree(path.join(xplane, 'Aircraft', 'Bird'), {
      'bird.acf': 'old',
      'skunkcrafts_updater.cfg': 'version|1.0.0',
      'Bird_prefs.txt': 'mine',
    });
    const zip = await archive('Bird.zip', {
      'Bird/bird.acf': 'new',
      'Bird/skunkcrafts_updater.cfg': 'version|2.0.0',
    });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip]);
    if (!analyzed.ok || !analyzed.value[0]) throw new Error('nothing detected');
    const [task] = manager.prepareInstallTasks([analyzed.value[0]]);
    if (!task) throw new Error('no task');
    task.installMode = 'clean';
    const installed = await manager.install([task]);
    if (!installed.ok) throw new Error(installed.error.code);
    expect(readTree(path.join(xplane, 'Aircraft', 'Bird'))).toEqual({
      'bird.acf': 'new',
      'skunkcrafts_updater.cfg': 'version|2.0.0',
      'Bird_prefs.txt': 'mine',
    });
  });

  it('says a drop was a folder, whatever is inside', async () => {
    const inner = await archive('Plane.zip', { 'Plane/plane.acf': 'acf' });
    const folder = path.join(dir, 'Downloads');
    fs.mkdirSync(folder);
    fs.copyFileSync(inner, path.join(folder, 'Plane.zip'));
    const analyzed = await new InstallerManager(xplane).analyze([folder]);
    if (!analyzed.ok) throw new Error(analyzed.error.code);
    expect(analyzed.value[0]).toMatchObject({ archiveFormat: 'zip', sourceFormat: 'folder' });
  });

  it('finds every add-on in an archive laid out like the X-Plane folder', async () => {
    const zip = await archive('Bundle.zip', {
      'Aircraft/Bird/bird.acf': 'acf',
      'Resources/plugins/Tool/64/win.xpl': 'xpl',
      'Custom Scenery/KSEA/Earth nav data/apt.dat': 'apt',
      'Custom Scenery/KSEA/Earth nav data/+40-130/+47-123.dsf': 'dsf',
      'Resources/plugins/FlyWithLua/Scripts/hello.lua': 'lua',
    });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip]);
    if (!analyzed.ok) throw new Error(analyzed.error.code);
    const found = analyzed.value.map((i) => [i.addonType, i.displayName, i.archiveInternalRoot]);
    expect(found).toEqual(
      expect.arrayContaining([
        ['Aircraft', 'Bird', 'Aircraft/Bird/'],
        ['Plugin', 'Tool', 'Resources/plugins/Tool/'],
        ['Scenery', 'KSEA', 'Custom Scenery/KSEA/'],
        ['LuaScript', 'Scripts', 'Resources/plugins/FlyWithLua/Scripts/'],
      ])
    );
    expect(found).toHaveLength(4);

    const tasks = manager.prepareInstallTasks(analyzed.value);
    const installed = await manager.install(tasks);
    if (!installed.ok) throw new Error(installed.error.code);
    expect(installed.value.every((r) => r.success)).toBe(true);
    expect(readTree(path.join(xplane, 'Aircraft', 'Bird'))).toEqual({ 'bird.acf': 'acf' });
    expect(readTree(path.join(xplane, 'Resources', 'plugins', 'Tool'))).toEqual({
      '64/win.xpl': 'xpl',
    });
    expect(readTree(path.join(xplane, 'Resources', 'plugins', 'FlyWithLua', 'Scripts'))).toEqual({
      'hello.lua': 'lua',
    });
  });

  it('analyzes several dropped files as one drop', async () => {
    const a = await archive('A.zip', { 'A/a.acf': 'acf' });
    const b = await archive('B.7z', { 'B/64/b.xpl': 'xpl' });
    const analyzed = await new InstallerManager(xplane).analyze([a, b]);
    if (!analyzed.ok) throw new Error(analyzed.error.code);
    expect(analyzed.value.map((i) => i.displayName)).toEqual(['A', 'B']);
  });

  it('warns when a scenery needs a library that is not installed', async () => {
    const tile = buildDsf({
      objects: ['objects/tower.obj', 'opensceneryx/objects/car.obj'],
      polygons: ['lib/airport/pavement/asphalt.pol'],
    });
    const src = fs.mkdtempSync(path.join(dir, 'ksea-'));
    tree(src, { 'KSEA/objects/tower.obj': 'obj', 'KSEA/Earth nav data/apt.dat': 'A' });
    fs.mkdirSync(path.join(src, 'KSEA', 'Earth nav data', '+40-130'));
    fs.writeFileSync(path.join(src, 'KSEA', 'Earth nav data', '+40-130', '+47-123.dsf'), tile);
    const zip = path.join(dir, 'KSEA.zip');
    execFileSync(await sevenZip(), ['a', '-y', zip, '.'], { cwd: src, stdio: 'ignore' });
    tree(path.join(xplane, 'Resources', 'default scenery', 'sim objects'), {
      'library.txt': 'EXPORT lib/airport/pavement/asphalt.pol a.pol',
    });

    const analyzed = await new InstallerManager(xplane).analyze([zip]);
    if (!analyzed.ok) throw new Error(analyzed.error.code);
    expect(analyzed.value[0]?.addonType).toBe('Scenery');
    expect(analyzed.value[0]?.warnings).toEqual([
      { code: 'MISSING_LIBRARIES', params: { libraries: 'opensceneryx', count: 1 } },
    ]);

    tree(path.join(xplane, 'Custom Scenery', 'OpenSceneryX'), {
      'library.txt': 'EXPORT opensceneryx/objects/car.obj car.obj',
    });
    const again = await new InstallerManager(xplane).analyze([zip]);
    if (!again.ok) throw new Error(again.error.code);
    expect(again.value[0]?.warnings).toEqual([]);
  });

  it('reports progress that only ever grows and ends at the total', async () => {
    // Random bytes: repeated text compresses so well it trips the zip-bomb guard
    const noise = (n: number) => crypto.randomBytes(n).toString('base64').slice(0, n);
    const zip = await archive('Many.zip', {
      'Many/many.acf': noise(30_000),
      'Many/objects/b.obj': noise(20_000),
      'Many/objects/c.obj': noise(10_000),
      'Many/liveries/d/d.png': noise(5_000),
    });
    const manager = new InstallerManager(xplane);
    const analyzed = await manager.analyze([zip]);
    if (!analyzed.ok || !analyzed.value[0]) throw new Error('nothing detected');
    const tasks = manager.prepareInstallTasks([analyzed.value[0]]);
    const seen: number[] = [];
    const installed = await manager.install(tasks, {
      onProgress: (p) => seen.push(p.bytesProcessed),
    });
    expect(installed.ok).toBe(true);
    expect(seen.length).toBeGreaterThan(1);
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1] ?? 0);
    }
    expect(seen[seen.length - 1]).toBe(tasks[0]?.estimatedSize);
  });
});
