import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDsf } from '../core/dsfFixture';
import { parseLibraryExportLines } from './libraryTxt';
import {
  buildLibraryIndex,
  isLibraryReference,
  libraryNameOf,
  missingLibrariesFor,
  ownFileChecker,
} from './missingLibraries';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-libs-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

function write(rel: string, content: string | Buffer): string {
  const file = path.join(dir, ...rel.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return file;
}

describe('parseLibraryExportLines', () => {
  it('collects the virtual path of every EXPORT form', () => {
    const text = [
      'A',
      '800',
      'LIBRARY',
      '# comment',
      'REGION_DEFINE all',
      'EXPORT lib/airport/a.obj objects/a.obj',
      'EXPORT_RATIO 0.5 lib/airport/b.obj objects/b.obj',
      'EXPORT_EXTEND  opensceneryx/objects/c.obj\tobjects/c.obj',
      'EXPORT_EXCLUDE lib/white-paint.pol pol/w.pol',
      'EXPORT_BACKUP lib/airport/d.obj objects/d.obj',
      'PRIVATE',
      'EXPORT SAM_Library/jetway.obj jetway.obj',
      'EXPORT_SEASON spr,sum\tlib/vegetation/trees/oak.for\t\tspr/oak.for',
      'EXPORT_EXCLUDE_SEASON fal\tlib/g10/terrain10/fruit.ter\tfal/fruit.ter',
    ].join('\n');
    expect(parseLibraryExportLines(text)).toEqual([
      'lib/airport/a.obj',
      'lib/airport/b.obj',
      'opensceneryx/objects/c.obj',
      'lib/white-paint.pol',
      'lib/airport/d.obj',
      'SAM_Library/jetway.obj',
      'lib/vegetation/trees/oak.for',
      'lib/g10/terrain10/fruit.ter',
    ]);
  });
});

describe('libraryNameOf', () => {
  it('names the library a path belongs to', () => {
    expect(libraryNameOf('opensceneryx/objects/vehicles/car.obj')).toBe('opensceneryx');
    expect(libraryNameOf('SAM_Library/jetway.obj')).toBe('SAM_Library');
    expect(libraryNameOf('lib/airport/pavement/asphalt.pol')).toBe('lib/airport');
    expect(libraryNameOf('lib/g10/roads.net')).toBe('lib/g10');
  });
});

describe('buildLibraryIndex', () => {
  it('reads every library.txt under the X-Plane library folders, lower-cased', async () => {
    write('Custom Scenery/OpenSceneryX/Library.txt', 'EXPORT OpenSceneryX/objects/Car.obj a.obj');
    write(
      'Resources/default scenery/sim objects/library.txt',
      'EXPORT lib/airport/tower.obj t.obj'
    );
    write('Global Scenery/X-Plane 12 Global Scenery/library.txt', 'EXPORT lib/g10/roads.net r.net');
    write('Custom Scenery/KSEA/Earth nav data/apt.dat', 'A');
    const index = await buildLibraryIndex(dir);
    expect([...index].sort()).toEqual([
      'lib/airport/tower.obj',
      'lib/g10/roads.net',
      'opensceneryx/objects/car.obj',
    ]);
  });
});

describe('missingLibrariesFor', () => {
  it('reports libraries nothing provides, not the package’s own files or exports', async () => {
    const tile = write(
      'KSEA/Earth nav data/+40-130/+47-123.dsf',
      buildDsf({
        objects: ['objects/tower.obj', 'opensceneryx/objects/car.obj', 'ruscenery/tree.obj'],
        polygons: ['lib/airport/pavement/asphalt.pol', 'KSEA_lib/paint.pol'],
        networks: ['lib/g10/roads.net'],
      })
    );
    write('KSEA/objects/tower.obj', 'obj');
    const index = new Set(['lib/airport/pavement/asphalt.pol', 'lib/g10/roads.net']);

    const missing = await missingLibrariesFor({
      dsfPaths: [tile],
      hasOwnFile: ownFileChecker(path.join(dir, 'KSEA')),
      index,
      ownExports: ['KSEA_lib/paint.pol'],
    });
    expect(missing).toEqual(['opensceneryx', 'ruscenery']);
  });

  it('is empty when every reference resolves', async () => {
    const tile = write('P/Earth nav data/a.dsf', buildDsf({ objects: ['objects/a.obj'] }));
    write('P/objects/a.obj', 'obj');
    expect(
      await missingLibrariesFor({
        dsfPaths: [tile],
        hasOwnFile: ownFileChecker(path.join(dir, 'P')),
        index: new Set(),
      })
    ).toEqual([]);
  });

  it("leaves out X-Plane's own lib/ tree and a package's broken local files", async () => {
    const tile = write(
      'Q/Earth nav data/a.dsf',
      buildDsf({
        objects: [
          'objects/gone.obj',
          'lib/airport/removed_in_xp12.obj',
          'loose.obj',
          'ruscenery/t.obj',
        ],
      })
    );
    expect(
      await missingLibrariesFor({
        dsfPaths: [tile],
        hasOwnFile: ownFileChecker(path.join(dir, 'Q')),
        index: new Set(),
      })
    ).toEqual(['ruscenery']);
  });
});

describe('isLibraryReference', () => {
  it('tells library paths from local and built-in ones', () => {
    expect(isLibraryReference('opensceneryx/objects/car.obj')).toBe(true);
    expect(isLibraryReference('SAM_Library/jetway.obj')).toBe(true);
    expect(isLibraryReference('lib/airport/tower.obj')).toBe(false);
    expect(isLibraryReference('::FLATTEN::.pol')).toBe(false);
    expect(isLibraryReference('objects/tower.obj')).toBe(false);
    expect(isLibraryReference('tower.obj')).toBe(false);
  });
});
