/**
 * Builds a small, valid DSF in memory for tests: header with properties, then
 * the definition tables. Geometry and commands are left out; the readers stop
 * at DEFN anyway.
 */
export interface DsfFixture {
  properties?: Record<string, string>;
  terrain?: string[];
  objects?: string[];
  polygons?: string[];
  networks?: string[];
}

function atom(name: string, payload: Buffer): Buffer {
  // The ID is stored reversed; the length (header included) follows little-endian
  const out = Buffer.alloc(8 + payload.length);
  Buffer.from(name, 'ascii').reverse().copy(out, 0);
  out.writeUInt32LE(8 + payload.length, 4);
  payload.copy(out, 8);
  return out;
}

function strings(values: string[]): Buffer {
  return Buffer.from(values.map((v) => `${v}\0`).join(''), 'utf8');
}

export function buildDsf(fixture: DsfFixture = {}): Buffer {
  const props = Object.entries({
    'sim/west': '13',
    'sim/east': '14',
    ...fixture.properties,
  }).flat();
  const head = atom('HEAD', atom('PROP', strings(props)));
  const defn = atom(
    'DEFN',
    Buffer.concat([
      atom('TERT', strings(fixture.terrain ?? [])),
      atom('OBJT', strings(fixture.objects ?? [])),
      atom('POLY', strings(fixture.polygons ?? [])),
      atom('NETW', strings(fixture.networks ?? [])),
    ])
  );
  const magic = Buffer.from('XPLNEDSF', 'ascii');
  const version = Buffer.alloc(4);
  version.writeUInt32LE(1, 0);
  const footer = Buffer.alloc(16); // md5, not checked by any reader here
  return Buffer.concat([magic, version, head, defn, footer]);
}
