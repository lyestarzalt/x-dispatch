// src/lib/addonManager/core/dsfParser.ts
import type { FileHandle } from 'fs/promises';
import * as fsp from 'fs/promises';
import { type DsfInfo } from './types';

const DSF_MAGIC = 'XPLNEDSF';
// Atom IDs as read by readUInt32LE (little-endian byte order)
// "DAEH" bytes (44 41 45 48) → LE uint32 = 0x48454144
// "PORP" bytes (50 4F 52 50) → LE uint32 = 0x50524F50
const ATOM_DAEH = 0x48454144;
const ATOM_PORP = 0x50524f50;

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
export async function parseDsfHeader(dsfPath: string): Promise<DsfInfo> {
  let handle: FileHandle | undefined;

  try {
    handle = await fsp.open(dsfPath, 'r');
    const headerBuffer = Buffer.alloc(12);

    // Read magic + version
    const { bytesRead } = await handle.read(headerBuffer, 0, 12, 0);
    if (bytesRead < 12) {
      return { parsed: false };
    }

    // Check magic bytes. A 7z signature means a compressed DSF, not supported.
    const magic = headerBuffer.subarray(0, 8).toString('ascii');
    if (magic !== DSF_MAGIC) {
      return { parsed: false };
    }

    // Skip version (4 bytes), now at offset 12
    // Read atoms looking for DAEH (HEAD)
    let offset = 12;
    const stat = await handle.stat();
    const fileSize = stat.size;

    // Limit search to first 64KB for performance
    const maxOffset = Math.min(fileSize, 65536);
    const atomBuffer = Buffer.alloc(8);

    while (offset < maxOffset) {
      const read = await handle.read(atomBuffer, 0, 8, offset);
      if (read.bytesRead < 8) break;

      const atomId = atomBuffer.readUInt32LE(0);
      const atomLength = atomBuffer.readUInt32LE(4);

      if (atomLength < 8 || atomLength > fileSize - offset) {
        // Invalid atom length
        break;
      }

      if (atomId === ATOM_DAEH) {
        // Found HEAD atom, search for PORP inside it
        const propResult = await findPropInHead(handle, offset + 8, atomLength - 8);
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
    await handle?.close().catch(() => undefined);
  }
}

interface PropResult {
  isOverlay: boolean;
  creationAgent: string;
  hasTerrainRefs: boolean;
}

async function findPropInHead(
  handle: FileHandle,
  headStart: number,
  headLength: number
): Promise<PropResult | undefined> {
  const atomBuffer = Buffer.alloc(8);
  let offset = headStart;
  const headEnd = headStart + headLength;

  while (offset < headEnd) {
    const read = await handle.read(atomBuffer, 0, 8, offset);
    if (read.bytesRead < 8) break;

    const atomId = atomBuffer.readUInt32LE(0);
    const atomLength = atomBuffer.readUInt32LE(4);

    if (atomLength < 8) break;

    if (atomId === ATOM_PORP) {
      // Found PROP atom, parse key-value pairs
      const dataLength = atomLength - 8;
      const dataBuffer = Buffer.alloc(dataLength);
      await handle.read(dataBuffer, 0, dataLength, offset + 8);

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
    const key = data.subarray(keyStart, i).toString('utf-8');
    i++; // Skip null

    // Read value (null-terminated)
    const valueStart = i;
    while (i < data.length && data[i] !== 0) i++;
    const value = data.subarray(valueStart, i).toString('utf-8');
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
