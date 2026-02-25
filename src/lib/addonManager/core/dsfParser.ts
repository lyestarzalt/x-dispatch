// src/lib/addonManager/core/dsfParser.ts
import * as fs from 'fs';
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
