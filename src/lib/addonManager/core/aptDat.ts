/**
 * Minimal apt.dat reader.
 *
 * Only the airport identifiers are needed here, to tell the user when two
 * scenery packs both claim the same airport. Row 1 is a land airport, 16 a
 * seaplane base, 17 a heliport, and the identifier is the fifth field.
 */
import * as fsp from 'fs/promises';

/** A pack listing more than this is a global dataset, not a custom airport. */
const MAX_READ_BYTES = 4 * 1024 * 1024;

const AIRPORT_ROWS = new Set(['1', '16', '17']);

/**
 * Airport identifiers an apt.dat declares, uppercased and deduplicated.
 */
export async function parseAptIcaos(aptPath: string): Promise<string[]> {
  let content: string;
  try {
    const handle = await fsp.open(aptPath, 'r');
    try {
      const { size } = await handle.stat();
      const length = Math.min(size, MAX_READ_BYTES);
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, 0);
      content = buffer.toString('utf-8');
    } finally {
      await handle.close().catch(() => undefined);
    }
  } catch {
    return [];
  }

  const icaos = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    const fields = trimmed.split(/\s+/);
    const row = fields[0] ?? '';

    if (AIRPORT_ROWS.has(row)) {
      const id = fields[4];
      if (id) icaos.add(id.toUpperCase());
      continue;
    }

    if (row === '1302' && fields[1] === 'icao_code') {
      const id = fields[2];
      if (id) icaos.add(id.toUpperCase());
    }
  }

  return [...icaos];
}
