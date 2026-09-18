/**
 * DSF definition table reader.
 *
 * A DSF's DEFN atom lists every object, polygon and network it draws with, as
 * virtual library paths like `opensceneryx/objects/vehicles/car.obj`. Reading
 * that table is what makes it possible to tell a user which library a pack
 * needs before X-Plane greets them with red boxes.
 *
 * Compressed DSFs are skipped: their header is 7z, not XPLNEDSF.
 */
import type { FileHandle } from 'fs/promises';
import * as fsp from 'fs/promises';

const DSF_MAGIC = 'XPLNEDSF';

// Atom IDs spell their name backwards on disk, so a little-endian read gives
// the name in order: bytes "NFED" read back as 0x4445464E, i.e. "DEFN".
const ATOM_DEFN = 0x4445464e;
const ATOM_OBJT = 0x4f424a54;
const ATOM_POLY = 0x504f4c59;
const ATOM_NETW = 0x4e455457;

/** Definition tables that name library assets. */
const ASSET_ATOMS = new Set([ATOM_OBJT, ATOM_POLY, ATOM_NETW]);

/** Definition tables are small; refuse anything that claims otherwise. */
const MAX_TABLE_BYTES = 4 * 1024 * 1024;

function splitNullTerminated(data: Buffer): string[] {
  const values: string[] = [];
  let start = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i] !== 0) continue;
    if (i > start) values.push(data.subarray(start, i).toString('utf-8'));
    start = i + 1;
  }
  if (start < data.length) values.push(data.subarray(start).toString('utf-8'));
  return values;
}

async function readAtomHeader(
  handle: FileHandle,
  offset: number
): Promise<{ id: number; length: number } | null> {
  const buffer = Buffer.alloc(8);
  const { bytesRead } = await handle.read(buffer, 0, 8, offset);
  if (bytesRead < 8) return null;
  return { id: buffer.readUInt32LE(0), length: buffer.readUInt32LE(4) };
}

/**
 * Every asset path a DSF references, in file order and without duplicates.
 */
export async function parseDsfDefinitions(dsfPath: string): Promise<string[]> {
  let handle: FileHandle | undefined;

  try {
    handle = await fsp.open(dsfPath, 'r');

    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, 12, 0);
    if (bytesRead < 12 || header.subarray(0, 8).toString('ascii') !== DSF_MAGIC) {
      return [];
    }

    const { size } = await handle.stat();
    let offset = 12;

    while (offset < size) {
      const atom = await readAtomHeader(handle, offset);
      if (!atom || atom.length < 8 || atom.length > size - offset) break;

      if (atom.id === ATOM_DEFN) {
        return await readDefinitionTables(handle, offset + 8, atom.length - 8);
      }

      offset += atom.length;
    }

    return [];
  } catch {
    return [];
  } finally {
    await handle?.close().catch(() => undefined);
  }
}

async function readDefinitionTables(
  handle: FileHandle,
  start: number,
  length: number
): Promise<string[]> {
  const found: string[] = [];
  const seen = new Set<string>();
  const end = start + length;
  let offset = start;

  while (offset < end) {
    const atom = await readAtomHeader(handle, offset);
    if (!atom || atom.length < 8 || offset + atom.length > end) break;

    const dataLength = atom.length - 8;
    if (ASSET_ATOMS.has(atom.id) && dataLength > 0 && dataLength <= MAX_TABLE_BYTES) {
      const data = Buffer.alloc(dataLength);
      await handle.read(data, 0, dataLength, offset + 8);
      for (const value of splitNullTerminated(data)) {
        const trimmed = value.trim();
        if (trimmed && !seen.has(trimmed)) {
          seen.add(trimmed);
          found.push(trimmed);
        }
      }
    }

    offset += atom.length;
  }

  return found;
}

/**
 * The library a virtual path belongs to: its first path component.
 * Paths without a separator are the pack's own files, not library references.
 */
export function libraryPrefix(virtualPath: string): string | null {
  const normalized = virtualPath.replace(/\\/g, '/');
  const slash = normalized.indexOf('/');
  if (slash <= 0) return null;
  return normalized.slice(0, slash);
}
