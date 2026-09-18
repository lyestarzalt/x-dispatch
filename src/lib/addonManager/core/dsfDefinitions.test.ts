import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseAptIcaos } from './aptDat';
import { libraryPrefix, parseDsfDefinitions } from './dsfDefinitions';

let tmp: string;

beforeEach(() => {
  tmp = path.join(os.tmpdir(), `xd-dsf-${Date.now()}-${Math.random()}`);
  fs.mkdirSync(tmp, { recursive: true });
});

afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

/**
 * Atom IDs are stored with their name reversed, so a little-endian read spells
 * the name forwards.
 */
function atom(name: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.write([...name].reverse().join(''), 0, 'ascii');
  header.writeUInt32LE(payload.length + 8, 4);
  return Buffer.concat([header, payload]);
}

function strings(values: string[]): Buffer {
  return Buffer.concat(
    values.map((v) => Buffer.concat([Buffer.from(v, 'utf-8'), Buffer.from([0])]))
  );
}

function writeDsf(file: string, objects: string[], polygons: string[] = []): string {
  const header = Buffer.alloc(12);
  header.write('XPLNEDSF', 0, 'ascii');
  header.writeUInt32LE(1, 8);

  const defn = atom(
    'DEFN',
    Buffer.concat([
      atom('TERT', strings(['terrain/water.ter'])),
      atom('OBJT', strings(objects)),
      atom('POLY', strings(polygons)),
    ])
  );

  const full = path.join(tmp, file);
  fs.writeFileSync(full, Buffer.concat([header, defn]));
  return full;
}

describe('parseDsfDefinitions', () => {
  it('reads the object and polygon tables', async () => {
    const dsf = writeDsf(
      'a.dsf',
      ['opensceneryx/objects/tree.obj', 'objects/local.obj'],
      ['ruscenery/pol/grass.pol']
    );

    expect(await parseDsfDefinitions(dsf)).toEqual([
      'opensceneryx/objects/tree.obj',
      'objects/local.obj',
      'ruscenery/pol/grass.pol',
    ]);
  });

  it('returns nothing for a compressed or unreadable DSF', async () => {
    const compressed = path.join(tmp, 'z.dsf');
    fs.writeFileSync(
      compressed,
      Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0, 0, 0, 0, 0, 0])
    );

    expect(await parseDsfDefinitions(compressed)).toEqual([]);
    expect(await parseDsfDefinitions(path.join(tmp, 'missing.dsf'))).toEqual([]);
  });

  it('takes the library from the first path component', () => {
    expect(libraryPrefix('opensceneryx/objects/tree.obj')).toBe('opensceneryx');
    expect(libraryPrefix('tree.obj')).toBeNull();
    expect(libraryPrefix('/leading.obj')).toBeNull();
  });
});

describe('parseAptIcaos', () => {
  it('reads airport, seaplane and heliport rows', async () => {
    const apt = path.join(tmp, 'apt.dat');
    fs.writeFileSync(
      apt,
      [
        'I',
        '1000 Version',
        '',
        '1 83 0 0 EGLL London Heathrow',
        '100 44.5 1 0 0.25 0 2 1 09L 51.4 -0.4',
        '16 0 0 0 XS01 Seaplane Base',
        '17 100 0 0 XH01 Heliport',
        '99',
      ].join('\n')
    );

    expect((await parseAptIcaos(apt)).sort()).toEqual(['EGLL', 'XH01', 'XS01']);
  });

  it('picks up an icao_code metadata row', async () => {
    const apt = path.join(tmp, 'apt.dat');
    fs.writeFileSync(
      apt,
      ['I', '1000 Version', '1 83 0 0 XXXX Name', '1302 icao_code EGLL'].join('\n')
    );

    expect((await parseAptIcaos(apt)).sort()).toEqual(['EGLL', 'XXXX']);
  });

  it('returns nothing for a file that is not there', async () => {
    expect(await parseAptIcaos(path.join(tmp, 'nope.dat'))).toEqual([]);
  });
});
