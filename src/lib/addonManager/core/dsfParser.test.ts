import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildDsf } from './dsfFixture';
import { parseDsfDefinitions, parseDsfHeader, readDsfDefinitions } from './dsfParser';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xd-dsf-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const TILE = {
  properties: { 'sim/overlay': '1', 'sim/creation_agent': 'WorldEditor' },
  objects: ['objects/tower.obj', 'opensceneryx/objects/vehicles/car.obj'],
  polygons: ['lib/airport/pavement/asphalt_1D.pol'],
  networks: ['lib/g10/roads.net'],
  terrain: ['terrain/grass.ter'],
};

describe('parseDsfDefinitions', () => {
  it('reads every definition table', () => {
    expect(parseDsfDefinitions(buildDsf(TILE))).toEqual({
      complete: true,
      definitions: {
        objects: TILE.objects,
        polygons: TILE.polygons,
        networks: TILE.networks,
        terrain: TILE.terrain,
      },
    });
  });

  it('says when the bytes end before the tables do', () => {
    const whole = buildDsf(TILE);
    expect(parseDsfDefinitions(whole.subarray(0, 40))).toEqual({
      complete: false,
      definitions: null,
    });
  });

  it('rejects what is not a DSF', () => {
    expect(parseDsfDefinitions(Buffer.from('PK\x03\x04 not a dsf at all'))).toEqual({
      complete: true,
      definitions: null,
    });
  });
});

describe('readDsfDefinitions', () => {
  it('reads a plain tile and the existing header parser still agrees', async () => {
    const file = path.join(dir, 'plain.dsf');
    fs.writeFileSync(file, buildDsf(TILE));
    expect((await readDsfDefinitions(file))?.objects).toEqual(TILE.objects);
    expect(parseDsfHeader(file)).toMatchObject({ parsed: true, isOverlay: true });
  });

  it('reads a 7-Zip-compressed tile the way X-Plane ships them', async () => {
    const plain = path.join(dir, 'src', '+47+013.dsf');
    fs.mkdirSync(path.dirname(plain));
    fs.writeFileSync(plain, buildDsf(TILE));
    const compressed = path.join(dir, '+47+013.dsf');
    const { path7za } = await import('7zip-bin');
    execFileSync(path7za, ['a', '-t7z', '-y', compressed, '+47+013.dsf'], {
      cwd: path.dirname(plain),
      stdio: 'ignore',
    });
    expect(fs.readFileSync(compressed).subarray(0, 2)).toEqual(Buffer.from([0x37, 0x7a]));

    expect((await readDsfDefinitions(compressed))?.polygons).toEqual(TILE.polygons);
  });

  it('returns null for a missing or foreign file', async () => {
    expect(await readDsfDefinitions(path.join(dir, 'nope.dsf'))).toBeNull();
    const text = path.join(dir, 'text.dsf');
    fs.writeFileSync(text, 'hello');
    expect(await readDsfDefinitions(text)).toBeNull();
  });
});
