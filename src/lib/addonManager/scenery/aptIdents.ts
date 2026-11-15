/**
 * The airport identifiers an apt.dat declares, for finding packs that cover the
 * same airport. Reads the file as a stream: ortho and regional packs can carry a
 * large apt.dat, and only the header rows matter.
 */
import * as fs from 'fs';
import * as readline from 'readline';

/** Row codes that open an airport: land, seaplane base, heliport. */
const AIRPORT_ROWS = new Set(['1', '16', '17']);

/**
 * Identifiers in file order, de-duplicated. A `1302 icao_code` row replaces the
 * identifier of the airport it belongs to, which is how packs publish a real ICAO
 * for an airport whose header still carries a local code.
 */
export async function readAptIdents(aptPath: string): Promise<string[]> {
  const idents: string[] = [];
  let current = -1;
  const stream = fs.createReadStream(aptPath, { encoding: 'utf8' });
  const lines = readline.createInterface({ input: stream, crlfDelay: Infinity });
  try {
    for await (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const space = line.indexOf(' ');
      const code = space === -1 ? line : line.slice(0, space);
      if (AIRPORT_ROWS.has(code)) {
        const parts = line.split(/\s+/);
        const ident = parts[4];
        if (!ident) continue;
        idents.push(ident.toUpperCase());
        current = idents.length - 1;
      } else if (code === '1302' && current >= 0) {
        const parts = line.split(/\s+/);
        if (parts[1] === 'icao_code' && parts[2]) idents[current] = parts[2].toUpperCase();
      } else if (code === '99') {
        break;
      }
    }
  } finally {
    lines.close();
    stream.destroy();
  }
  return [...new Set(idents)];
}
