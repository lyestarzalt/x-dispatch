// src/lib/addonManager/scenery/folderScanner.ts
import type { Dirent } from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { parseAptIcaos } from '../core/aptDat';
import { libraryPrefix, parseDsfDefinitions } from '../core/dsfDefinitions';
import { parseDsfHeader } from '../core/dsfParser';
import { type SceneryClassification, createDefaultClassification } from '../core/types';

const MAX_APT_DAT_DEPTH = 5;
const MAX_DSF_SEARCH_DEPTH = 3;
const MAX_LIBRARY_READ_BYTES = 64 * 1024;
/** DSFs read for library references. A pack draws from the same libraries
 * throughout, and an ortho set has thousands of tiles. */
const MAX_DSF_DEFINITION_READS = 4;

/**
 * Symlink-aware directory check.
 * Follows symlinks via stat fallback (same pattern as customSceneryLoader.ts).
 */
async function isDirectoryEntry(entry: Dirent, parentPath: string): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return (await fsp.stat(path.join(parentPath, entry.name))).isDirectory();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Symlink-aware file check.
 * Follows symlinks via stat fallback.
 */
async function isFileEntry(entry: Dirent, parentPath: string): Promise<boolean> {
  if (entry.isFile()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return (await fsp.stat(path.join(parentPath, entry.name))).isFile();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Read the first bytes of a file without pulling the whole thing into memory.
 */
async function readHead(filePath: string, byteCount: number): Promise<string> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(byteCount);
    const { bytesRead } = await handle.read(buf, 0, byteCount, 0);
    return bytesRead === 0 ? '' : buf.toString('utf8', 0, bytesRead);
  } finally {
    await handle.close().catch(() => undefined);
  }
}

/**
 * Validate that a file is a real apt.dat by checking its header.
 * Line 1 must be 'I' (IBM byte order) or 'A' (Apple byte order).
 */
async function isValidAptDat(filePath: string): Promise<boolean> {
  try {
    const head = await readHead(filePath, 16);
    const firstLine = (head.split(/\r?\n/)[0] ?? '').trim();
    return firstLine === 'I' || firstLine === 'A';
  } catch {
    return false;
  }
}

/**
 * Parse EXPORT / EXPORT_EXTEND directives from a library.txt file.
 * Returns unique first path components of virtual paths.
 */
async function parseLibraryExports(filePath: string): Promise<string[]> {
  try {
    const content = await readHead(filePath, MAX_LIBRARY_READ_BYTES);
    const prefixes = new Set<string>();

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      // Match EXPORT or EXPORT_EXTEND followed by whitespace and a virtual path
      if (!trimmed.startsWith('EXPORT')) continue;

      const match = trimmed.match(/^EXPORT(?:_EXTEND)?\s+(\S+)/);
      if (!match) continue;

      const virtualPath = match[1]!;
      // First path component (before first /)
      const firstComponent = virtualPath.split('/')[0];
      if (firstComponent) {
        prefixes.add(firstComponent);
      }
    }

    return [...prefixes];
  } catch {
    return [];
  }
}

/**
 * Scan a scenery folder to determine its classification markers.
 * Single-pass scan that checks for:
 * - library.txt (with export parsing)
 * - Earth nav data/ folder
 * - apt.dat (up to 5 levels deep in Earth nav data, with header validation)
 * - *.xpl plugin files
 * - *.dsf files (parses first one found for header info, collects count/names)
 *
 * Follows symlinks so symlinked scenery packs are detected correctly.
 * All I/O is async so a library of a few thousand packs does not block the
 * main thread while it is classified.
 */
export async function scanSceneryFolder(folderPath: string): Promise<SceneryClassification> {
  const classification = createDefaultClassification();

  // Security: basic path validation
  if (!folderPath || folderPath.includes('..')) {
    return classification;
  }

  let entries: Dirent[];
  try {
    entries = await fsp.readdir(folderPath, { withFileTypes: true });
  } catch {
    return classification;
  }

  for (const entry of entries) {
    const entryPath = path.join(folderPath, entry.name);
    const lowerName = entry.name.toLowerCase();

    try {
      if (await isFileEntry(entry, folderPath)) {
        if (lowerName === 'library.txt') {
          classification.hasLibraryTxt = true;
          classification.libraryExports = await parseLibraryExports(entryPath);
        }

        if (lowerName.endsWith('.xpl')) {
          classification.hasPlugins = true;
        }
      }

      if (await isDirectoryEntry(entry, folderPath)) {
        if (lowerName === 'earth nav data') {
          classification.hasEarthNavData = true;

          const earthNavResult = await scanEarthNavData(entryPath);
          classification.hasAptDat = earthNavResult.hasAptDat;
          classification.hasDsf = earthNavResult.hasDsf;
          classification.dsfCount = earthNavResult.dsfCount;
          classification.dsfFilenames = earthNavResult.dsfFilenames;
          classification.icaos = await collectIcaos(earthNavResult.aptDatPaths);
          classification.libraryRefs = await collectLibraryRefs(
            folderPath,
            earthNavResult.dsfPaths
          );

          if (earthNavResult.firstDsfPath) {
            classification.dsfInfo = await parseDsfHeader(earthNavResult.firstDsfPath);
          }
        }

        if (lowerName === 'plugins') {
          classification.hasPlugins = await hasPluginFiles(entryPath);
        }
      }
    } catch {
      // A single unreadable entry should not void the whole classification
    }
  }

  return classification;
}

interface EarthNavScanResult {
  hasAptDat: boolean;
  hasDsf: boolean;
  firstDsfPath: string;
  dsfCount: number;
  dsfFilenames: string[];
  aptDatPaths: string[];
  dsfPaths: string[];
}

/**
 * Airports declared across every apt.dat in the pack.
 */
async function collectIcaos(aptDatPaths: string[]): Promise<string[]> {
  const icaos = new Set<string>();
  for (const aptPath of aptDatPaths) {
    for (const icao of await parseAptIcaos(aptPath)) icaos.add(icao);
  }
  return [...icaos];
}

/** Prefix of the library X-Plane ships with, always present. */
const BUILTIN_LIBRARY = 'lib';

/**
 * Libraries the pack draws from, read out of a sample of its DSFs.
 * A reference that resolves to a file inside the pack is the pack's own asset,
 * not a dependency on someone else's library.
 */
async function collectLibraryRefs(folderPath: string, dsfPaths: string[]): Promise<string[]> {
  const libraries = new Set<string>();

  for (const dsfPath of dsfPaths.slice(0, MAX_DSF_DEFINITION_READS)) {
    for (const virtualPath of await parseDsfDefinitions(dsfPath)) {
      const prefix = libraryPrefix(virtualPath);
      if (!prefix || prefix.toLowerCase() === BUILTIN_LIBRARY) continue;
      if (libraries.has(prefix)) continue;

      try {
        await fsp.access(path.join(folderPath, ...virtualPath.split('/')));
        continue; // Ships with the pack
      } catch {
        libraries.add(prefix);
      }
    }
  }

  return [...libraries];
}

async function scanEarthNavData(earthNavPath: string): Promise<EarthNavScanResult> {
  const result: EarthNavScanResult = {
    hasAptDat: false,
    hasDsf: false,
    firstDsfPath: '',
    dsfCount: 0,
    dsfFilenames: [],
    aptDatPaths: [],
    dsfPaths: [],
  };

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > MAX_APT_DAT_DEPTH) return;

    let entries: Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Ignore errors in subdirectories
    }

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name);
      const lowerName = entry.name.toLowerCase();

      if (await isFileEntry(entry, dir)) {
        if (lowerName === 'apt.dat' && (await isValidAptDat(entryPath))) {
          result.hasAptDat = true;
          result.aptDatPaths.push(entryPath);
        }

        if (lowerName.endsWith('.dsf')) {
          result.hasDsf = true;
          result.dsfCount++;
          result.dsfFilenames.push(entry.name);
          if (result.dsfPaths.length < MAX_DSF_DEFINITION_READS) {
            result.dsfPaths.push(entryPath);
          }
          if (!result.firstDsfPath) {
            result.firstDsfPath = entryPath;
          }
        }
      }

      if (depth < MAX_DSF_SEARCH_DEPTH && (await isDirectoryEntry(entry, dir))) {
        await scan(entryPath, depth + 1);
      }
    }
  }

  await scan(earthNavPath, 0);
  return result;
}

async function hasPluginFiles(pluginsPath: string): Promise<boolean> {
  try {
    const entries = await fsp.readdir(pluginsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.toLowerCase().endsWith('.xpl') && (await isFileEntry(entry, pluginsPath))) {
        return true;
      }
    }
  } catch {
    // Ignore
  }
  return false;
}
