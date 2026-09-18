import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createInstallTask, findAircraftForLivery } from '../targetResolver';
import type { ArchiveEntry } from '../types';
import { detectAddons } from './TypeDetector';
import { detectLiveries, matchesAcfIdentifier } from './liveryPatterns';
import { detectLuaComponents } from './luaScripts';
import { detectNavdata } from './navdata';

function files(...paths: string[]): ArchiveEntry[] {
  return paths.map((p) => ({
    path: p,
    isDirectory: p.endsWith('/'),
    uncompressedSize: 1024,
    compressedSize: 512,
    encrypted: false,
  }));
}

describe('getAddonRoot via detectAddons', () => {
  it('installs the aircraft folder, not the folder wrapping it', () => {
    const detected = detectAddons(
      'C:/downloads/pack.zip',
      'zip',
      files('Pack/B738/B738.acf', 'Pack/B738/objects/fuselage.obj', 'Pack/readme.txt')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('Aircraft');
    expect(detected[0]!.archiveInternalRoot).toBe('Pack/B738/');
    expect(detected[0]!.displayName).toBe('B738');
  });

  it('treats an archive with the .acf at the root as the addon itself', () => {
    const detected = detectAddons(
      'C:/downloads/B738.zip',
      'zip',
      files('B738.acf', 'objects/a.obj')
    );

    expect(detected[0]!.archiveInternalRoot).toBeUndefined();
    expect(detected[0]!.displayName).toBe('B738');
  });

  it('keeps an AI variant with the aircraft it belongs to', () => {
    const detected = detectAddons(
      'C:/downloads/pack.zip',
      'zip',
      files('B738/B738.acf', 'B738/_TCAS_AI_/B738_AI.acf')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.archiveInternalRoot).toBe('B738/');
  });

  it('resolves a plugin through its platform folder', () => {
    const detected = detectAddons(
      'C:/downloads/plugin.zip',
      'zip',
      files('MyPlugin/64/win.xpl', 'MyPlugin/64/lin.xpl', 'MyPlugin/readme.txt')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('Plugin');
    expect(detected[0]!.archiveInternalRoot).toBe('MyPlugin/');
  });

  it('resolves scenery from its Earth nav data folder', () => {
    const detected = detectAddons(
      'C:/downloads/egll.zip',
      'zip',
      files('Airports/EGLL/Earth nav data/+50-000.dsf', 'Airports/EGLL/objects/a.obj')
    );

    expect(detected[0]!.addonType).toBe('Scenery');
    expect(detected[0]!.archiveInternalRoot).toBe('Airports/EGLL/');
  });

  it('installs the library folder rather than its wrapper', () => {
    const detected = detectAddons(
      'C:/downloads/lib.zip',
      'zip',
      files('Download/SAM_Library/library.txt', 'Download/SAM_Library/objects/a.obj')
    );

    expect(detected[0]!.addonType).toBe('SceneryLibrary');
    expect(detected[0]!.archiveInternalRoot).toBe('Download/SAM_Library/');
  });

  it('prefers Scenery when a folder has both library.txt and DSFs', () => {
    const detected = detectAddons(
      'C:/downloads/mix.zip',
      'zip',
      files('Pack/library.txt', 'Pack/Earth nav data/+50-000.dsf')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('Scenery');
  });

  it('ignores junk folders when sizing and detecting', () => {
    const detected = detectAddons(
      'C:/downloads/egll.zip',
      'zip',
      files('__MACOSX/EGLL/._apt.dat', 'EGLL/Earth nav data/+50-000.dsf')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.estimatedSize).toBe(1024);
  });
});

describe('livery detection', () => {
  it('finds a ToLiss A320 livery by its fuselage texture', () => {
    const matches = detectLiveries(
      files('Delta A320/objects/fuselage320_1.png', 'Delta A320/objects/LEAP1A.dds')
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]!.aircraftTypeId).toBe('TOLISS_A320');
    expect(matches[0]!.internalRoot).toBe('Delta A320/');
  });

  it('finds a livery packed at the archive root', () => {
    const matches = detectLiveries(files('objects/fuselage321_1.png', 'a321_icon11.png'));

    expect(matches[0]!.aircraftTypeId).toBe('TOLISS_A321');
    expect(matches[0]!.internalRoot).toBe('');
  });

  it('surfaces liveries as installable items', () => {
    const detected = detectAddons(
      'C:/downloads/livery.zip',
      'zip',
      files('Delta A320/objects/fuselage320_1.png')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('Livery');
    expect(detected[0]!.liveryInfo?.aircraftName).toBe('ToLiss A320');
  });

  it('does not offer liveries that ship inside an aircraft', () => {
    const detected = detectAddons(
      'C:/downloads/aircraft.zip',
      'zip',
      files('A320/a320.acf', 'A320/liveries/Delta/objects/fuselage320_1.png')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('Aircraft');
  });

  it('flags a livery whose aircraft is unknown', () => {
    const detected = detectAddons(
      'C:/downloads/unknown.zip',
      'zip',
      files('objects/paint.png', 'objects/paint2.dds', 'objects/body.obj')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('Livery');
    expect(detected[0]!.liveryInfo).toBeUndefined();
    expect(detected[0]!.warnings).toHaveLength(1);
  });

  it('matches aircraft by .acf name, not folder name', () => {
    expect(matchesAcfIdentifier('a320.acf', ['a320*'])).toBe(true);
    expect(matchesAcfIdentifier('A320neo.acf', ['a320*'])).toBe(true);
    expect(matchesAcfIdentifier('a321.acf', ['a320*'])).toBe(false);
    expect(matchesAcfIdentifier('777-300ER.acf', ['777-200*', '777-300*'])).toBe(true);
  });
});

describe('FlyWithLua components', () => {
  it('splits scripts and modules into their own folders', () => {
    const components = detectLuaComponents(
      files('Pack/Scripts/a.lua', 'Pack/Modules/b.lua', 'Pack/readme.txt')
    );

    expect(components).toEqual([
      { internalRoot: 'Pack/Scripts/', targetSubdir: 'Scripts' },
      { internalRoot: 'Pack/Modules/', targetSubdir: 'Modules' },
    ]);
  });

  it('treats a bare script as a Scripts drop', () => {
    expect(detectLuaComponents(files('a.lua'))).toEqual([
      { internalRoot: '', targetSubdir: 'Scripts' },
    ]);
  });

  it('keeps a script together with its data folder', () => {
    const components = detectLuaComponents(files('MyScript/a.lua', 'MyScript/data/x.txt'));
    expect(components).toEqual([{ internalRoot: 'MyScript/', targetSubdir: 'Scripts' }]);
  });

  it('reports one item per Lua pack, not one per script', () => {
    const detected = detectAddons(
      'C:/downloads/lua.zip',
      'zip',
      files('Pack/Scripts/a.lua', 'Pack/Scripts/b.lua', 'Pack/Modules/c.lua')
    );

    expect(detected).toHaveLength(1);
    expect(detected[0]!.addonType).toBe('LuaScript');
    expect(detected[0]!.luaComponents).toHaveLength(2);
  });
});

describe('navdata detection', () => {
  it('sends the native X-Plane set to Custom Data', () => {
    const result = detectNavdata(
      'C:/downloads/navigraph-2401.zip',
      files('cycle.json', 'earth_nav.dat', 'earth_fix.dat'),
      ''
    );

    expect(result.layout).toBe('xplane');
    expect(result.subPath).toEqual([]);
    expect(result.info.cycle).toBe('2401');
    expect(result.info.revision).toBe('Navigraph');
  });

  it('sends a GNS430 package to its own folder', () => {
    const result = detectNavdata(
      'C:/downloads/gns430.zip',
      files('GNS430/cycle.json', 'GNS430/navdata/Airports.txt'),
      'GNS430/'
    );

    expect(result.layout).toBe('gns430');
    expect(result.subPath).toEqual(['GNS430']);
  });

  it('sends a bare CIFP drop to Custom Data/CIFP', () => {
    const result = detectNavdata('C:/downloads/cifp.zip', files('cycle.json', 'CIFP/EGLL.dat'), '');

    expect(result.layout).toBe('cifp');
    expect(result.subPath).toEqual(['CIFP']);
  });

  it('carries the layout through to the install target', () => {
    const detected = detectAddons(
      'C:/downloads/gns.zip',
      'zip',
      files('GNS430/cycle.json', 'GNS430/navdata/Airports.txt')
    );

    const task = createInstallTask(detected[0]!, path.join('C:', 'X-Plane 12'));
    expect(task.targetPath).toBe(path.join('C:', 'X-Plane 12', 'Custom Data', 'GNS430'));
  });
});

describe('install targets', () => {
  let xpRoot: string;

  beforeEach(() => {
    xpRoot = path.join(os.tmpdir(), `xd-target-${Date.now()}-${Math.random()}`);
    fs.mkdirSync(path.join(xpRoot, 'Aircraft'), { recursive: true });
  });

  afterEach(() => fs.rmSync(xpRoot, { recursive: true, force: true }));

  it('finds the aircraft for a livery through its .acf file', () => {
    const folder = path.join(xpRoot, 'Aircraft', 'Airbus A320 renamed by me');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'a320.acf'), '');

    expect(findAircraftForLivery(path.join(xpRoot, 'Aircraft'), 'TOLISS_A320')).toBe(folder);
  });

  it('returns no aircraft when nothing matches', () => {
    const folder = path.join(xpRoot, 'Aircraft', 'Cessna');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'C172.acf'), '');

    expect(findAircraftForLivery(path.join(xpRoot, 'Aircraft'), 'TOLISS_A320')).toBeNull();
  });

  it('installs a livery into the matched aircraft', () => {
    const folder = path.join(xpRoot, 'Aircraft', 'ToLiss A320');
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'a320.acf'), '');

    const detected = detectAddons(
      'C:/downloads/livery.zip',
      'zip',
      files('Delta A320/objects/fuselage320_1.png')
    );
    const task = createInstallTask(detected[0]!, xpRoot);

    expect(task.targetPath).toBe(path.join(folder, 'liveries', 'Delta A320'));
  });

  it('maps a Lua pack onto the FlyWithLua folders', () => {
    const detected = detectAddons(
      'C:/downloads/lua.zip',
      'zip',
      files('Pack/Scripts/a.lua', 'Pack/Modules/b.lua')
    );
    const task = createInstallTask(detected[0]!, xpRoot);
    const flyWithLua = path.join(xpRoot, 'Resources', 'plugins', 'FlyWithLua');

    expect(task.components).toEqual([
      { internalRoot: 'Pack/Scripts/', targetPath: path.join(flyWithLua, 'Scripts') },
      { internalRoot: 'Pack/Modules/', targetPath: path.join(flyWithLua, 'Modules') },
    ]);
  });
});
