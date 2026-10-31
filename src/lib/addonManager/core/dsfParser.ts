// src/lib/addonManager/core/dsfParser.ts
import { spawn } from 'child_process';
import * as fs from 'fs';
import { type DsfInfo } from './types';

const DSF_MAGIC = 'XPLNEDSF';

/**
 * Atom IDs as read by readUInt32LE. A DSF writes the ID's four letters in
 * reverse ("DAEH" for HEAD), so reading the name big-endian gives the same int.
 */
function atomId(name: string): number {
  return Buffer.from(name, 'ascii').readUInt32BE(0);
}

const ATOM_DAEH = atomId('HEAD');
const ATOM_PORP = atomId('PROP');
const ATOM_DEFN = atomId('DEFN');
const ATOM_TERT = atomId('TERT');
const ATOM_OBJT = atomId('OBJT');
const ATOM_POLY = atomId('POLY');
const ATOM_NETW = atomId('NETW');

/** Definition tables go well past this only in broken files. */
const MAX_DEFINITIONS_BYTES = 8 * 1024 * 1024;
/** A 7-Zip child that produces nothing for this long is given up on. */
const DECOMPRESS_TIMEOUT_MS = 20_000;

/**
 * Parse DSF file header to extract classification info.
 * Only reads the header atoms, not the full file.
 *
 * DSF Structure:
 * - 8 bytes: magic "XPLNEDSF"
 * - 4 bytes: version
 * - Atoms: each has 4-byte ID + 4-byte length (little endian)
 * - DAEH (HEAD backwards) contains PORP (PROP backwards)
 * - PORP contains null-terminated key\0value\0 pairs
 *
 * We extract:
 * - sim/overlay: "1" means overlay scenery
 * - sim/creation_agent: tool that made it (WorldEditor = airport)
 */
export function parseDsfHeader(dsfPath: string): DsfInfo {
  let fd: number | undefined;

  try {
    fd = fs.openSync(dsfPath, 'r');
    const headerBuffer = Buffer.alloc(12);

    // Read magic + version
    const bytesRead = fs.readSync(fd, headerBuffer, 0, 12, 0);
    if (bytesRead < 12) {
      return { parsed: false };
    }

    // Check magic bytes
    const magic = headerBuffer.slice(0, 8).toString('ascii');
    if (magic !== DSF_MAGIC) {
      // Might be compressed (7z)
      if (headerBuffer[0] === 0x37 && headerBuffer[1] === 0x7a) {
        // 7z signature - compressed DSF not supported yet
        return { parsed: false };
      }
      return { parsed: false };
    }

    // Skip version (4 bytes), now at offset 12
    // Read atoms looking for DAEH (HEAD)
    let offset = 12;
    const stat = fs.statSync(dsfPath);
    const fileSize = stat.size;

    // Limit search to first 64KB for performance
    const maxOffset = Math.min(fileSize, 65536);
    const atomBuffer = Buffer.alloc(8);

    while (offset < maxOffset) {
      const read = fs.readSync(fd, atomBuffer, 0, 8, offset);
      if (read < 8) break;

      const atomId = atomBuffer.readUInt32LE(0);
      const atomLength = atomBuffer.readUInt32LE(4);

      if (atomLength < 8 || atomLength > fileSize - offset) {
        // Invalid atom length
        break;
      }

      if (atomId === ATOM_DAEH) {
        // Found HEAD atom, search for PORP inside it
        const propResult = findPropInHead(fd, offset + 8, atomLength - 8);
        if (propResult) {
          return {
            parsed: true,
            isOverlay: propResult.isOverlay,
            creationAgent: propResult.creationAgent,
            hasTerrainRefs: propResult.hasTerrainRefs,
          };
        }
      }

      offset += atomLength;
    }

    // No DAEH/PORP found
    return { parsed: false };
  } catch {
    return { parsed: false };
  } finally {
    if (fd !== undefined) {
      fs.closeSync(fd);
    }
  }
}

interface PropResult {
  isOverlay: boolean;
  creationAgent: string;
  hasTerrainRefs: boolean;
}

function findPropInHead(fd: number, headStart: number, headLength: number): PropResult | undefined {
  const atomBuffer = Buffer.alloc(8);
  let offset = headStart;
  const headEnd = headStart + headLength;

  while (offset < headEnd) {
    const read = fs.readSync(fd, atomBuffer, 0, 8, offset);
    if (read < 8) break;

    const atomId = atomBuffer.readUInt32LE(0);
    const atomLength = atomBuffer.readUInt32LE(4);

    if (atomLength < 8) break;

    if (atomId === ATOM_PORP) {
      // Found PROP atom, parse key-value pairs
      const dataLength = atomLength - 8;
      const dataBuffer = Buffer.alloc(dataLength);
      fs.readSync(fd, dataBuffer, 0, dataLength, offset + 8);

      return parsePropData(dataBuffer);
    }

    offset += atomLength;
  }

  return undefined;
}

function parsePropData(data: Buffer): PropResult {
  const props = new Map<string, string>();
  let i = 0;

  while (i < data.length) {
    // Read key (null-terminated)
    const keyStart = i;
    while (i < data.length && data[i] !== 0) i++;
    if (i >= data.length) break;
    const key = data.slice(keyStart, i).toString('utf-8');
    i++; // Skip null

    // Read value (null-terminated)
    const valueStart = i;
    while (i < data.length && data[i] !== 0) i++;
    const value = data.slice(valueStart, i).toString('utf-8');
    i++; // Skip null

    if (key) {
      props.set(key, value);
    }
  }

  const isOverlay = props.get('sim/overlay') === '1';
  const creationAgent = props.get('sim/creation_agent') ?? '';
  // Check for terrain references (indicates mesh)
  const hasTerrainRefs =
    props.has('sim/require_agpoint') ||
    props.has('sim/require_object') ||
    (props.get('sim/planet') ?? '').includes('earth');

  return { isOverlay, creationAgent, hasTerrainRefs };
}

/**
 * What a tile asks the library system for: every object, polygon, road
 * network and terrain definition, as virtual paths. These resolve to the
 * package's own files or to a library's `library.txt` exports.
 */
export interface DsfDefinitions {
  terrain: string[];
  objects: string[];
  polygons: string[];
  networks: string[];
}

function splitStrings(data: Buffer): string[] {
  return data
    .toString('utf8')
    .split('\0')
    .filter((s) => s.length > 0);
}

/**
 * Pull the DEFN tables out of DSF bytes. `complete` is false when the buffer
 * ends before DEFN does; `definitions` is null for something that is not a DSF.
 */
export function parseDsfDefinitions(buffer: Buffer): {
  complete: boolean;
  definitions: DsfDefinitions | null;
} {
  if (buffer.length < 12) return { complete: false, definitions: null };
  if (buffer.toString('ascii', 0, 8) !== DSF_MAGIC) return { complete: true, definitions: null };

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.readUInt32LE(offset);
    const length = buffer.readUInt32LE(offset + 4);
    if (length < 8) return { complete: true, definitions: null };

    if (id === ATOM_DAEH) {
      offset += length;
      continue;
    }
    if (id !== ATOM_DEFN) {
      // DEFN follows HEAD; anything else means the file has no definitions
      return {
        complete: true,
        definitions: { terrain: [], objects: [], polygons: [], networks: [] },
      };
    }
    if (offset + length > buffer.length) return { complete: false, definitions: null };

    const definitions: DsfDefinitions = { terrain: [], objects: [], polygons: [], networks: [] };
    let inner = offset + 8;
    const end = offset + length;
    while (inner + 8 <= end) {
      const innerId = buffer.readUInt32LE(inner);
      const innerLength = buffer.readUInt32LE(inner + 4);
      if (innerLength < 8 || inner + innerLength > end) break;
      const data = buffer.subarray(inner + 8, inner + innerLength);
      if (innerId === ATOM_TERT) definitions.terrain = splitStrings(data);
      else if (innerId === ATOM_OBJT) definitions.objects = splitStrings(data);
      else if (innerId === ATOM_POLY) definitions.polygons = splitStrings(data);
      else if (innerId === ATOM_NETW) definitions.networks = splitStrings(data);
      inner += innerLength;
    }
    return { complete: true, definitions };
  }
  return { complete: false, definitions: null };
}

async function readLeadingBytes(filePath: string, maxBytes: number): Promise<Buffer> {
  const handle = await fs.promises.open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    const buffer = Buffer.alloc(Math.min(size, maxBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Decompress a 7-Zip-wrapped DSF to stdout and stop as soon as the definition
 * tables are in hand: a 200 MB mesh tile costs a few hundred kilobytes.
 */
async function readCompressedDefinitions(filePath: string): Promise<DsfDefinitions | null> {
  const { path7za } = await import('7zip-bin');
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let total = 0;
    let done = false;
    const child = spawn(path7za, ['x', '-so', '-y', filePath], {
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    const finish = (definitions: DsfDefinitions | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      child.kill();
      resolve(definitions);
    };
    const timer = setTimeout(() => finish(null), DECOMPRESS_TIMEOUT_MS);

    child.stdout.on('data', (chunk: Buffer) => {
      if (done) return;
      chunks.push(chunk);
      total += chunk.length;
      const parsed = parseDsfDefinitions(Buffer.concat(chunks));
      if (parsed.complete) finish(parsed.definitions);
      else if (total > MAX_DEFINITIONS_BYTES) finish(null);
    });
    child.on('error', () => finish(null));
    child.on('close', () => {
      if (done) return;
      finish(parseDsfDefinitions(Buffer.concat(chunks)).definitions);
    });
  });
}

const definitionsCache = new Map<string, { key: string; definitions: DsfDefinitions | null }>();
const DEFINITIONS_CACHE_LIMIT = 4000;

/**
 * The definition tables of a DSF on disk, plain or 7-Zip-compressed; null when
 * the file is not a readable DSF. Results are cached by size and mtime.
 */
export async function readDsfDefinitions(dsfPath: string): Promise<DsfDefinitions | null> {
  let key: string;
  try {
    const stat = await fs.promises.stat(dsfPath);
    key = `${stat.size}:${stat.mtimeMs}`;
  } catch {
    return null;
  }
  const cached = definitionsCache.get(dsfPath);
  if (cached && cached.key === key) return cached.definitions;

  let definitions: DsfDefinitions | null;
  try {
    const head = await readLeadingBytes(dsfPath, 8);
    if (head[0] === 0x37 && head[1] === 0x7a) {
      definitions = await readCompressedDefinitions(dsfPath);
    } else {
      const bytes = await readLeadingBytes(dsfPath, MAX_DEFINITIONS_BYTES);
      definitions = parseDsfDefinitions(bytes).definitions;
    }
  } catch {
    definitions = null;
  }

  if (definitionsCache.size >= DEFINITIONS_CACHE_LIMIT) definitionsCache.clear();
  definitionsCache.set(dsfPath, { key, definitions });
  return definitions;
}
