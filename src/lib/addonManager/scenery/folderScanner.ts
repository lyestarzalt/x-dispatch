// src/lib/addonManager/scenery/folderScanner.ts
import * as fs from 'fs';
import * as path from 'path';
import { parseDsfHeader } from '../core/dsfParser';
import { type SceneryClassification, createDefaultClassification } from '../core/types';

const MAX_APT_DAT_DEPTH = 5;
const MAX_DSF_SEARCH_DEPTH = 3;
const MAX_LIBRARY_READ_BYTES = 64 * 1024;

/**
 * Symlink-aware directory check.
 * Follows symlinks via stat fallback (same pattern as customSceneryLoader.ts).
 */
async function isDirectoryEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return (await fs.promises.stat(path.join(parentPath, entry.name))).isDirectory();
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
async function isFileEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
  if (entry.isFile()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return (await fs.promises.stat(path.join(parentPath, entry.name))).isFile();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Validate that a file is a real apt.dat by checking its header.
 * Line 1 must be 'I' (IBM byte order) or 'A' (Apple byte order).
 */
async function isValidAptDat(filePath: string): Promise<boolean> {
  let fd: fs.promises.FileHandle | undefined;
  try {
    fd = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(16);
    const { bytesRead } = await fd.read(buf, 0, 16, 0);
    if (bytesRead === 0) return false;

    const firstLine = (buf.toString('utf8', 0, bytesRead).split(/\r?\n/)[0] ?? '').trim();
    return firstLine === 'I' || firstLine === 'A';
  } catch {
    return false;
  } finally {
    await fd?.close().catch(() => {});
  }
}

/**
 * Parse EXPORT / EXPORT_EXTEND directives from a library.txt file.
 * Returns unique first path components of virtual paths.
 */
async function parseLibraryExports(filePath: string): Promise<string[]> {
  let fd: fs.promises.FileHandle | undefined;
  try {
    fd = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(MAX_LIBRARY_READ_BYTES);
    const { bytesRead } = await fd.read(buf, 0, MAX_LIBRARY_READ_BYTES, 0);
    if (bytesRead === 0) return [];

    const content = buf.toString('utf8', 0, bytesRead);
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
  } finally {
    await fd?.close().catch(() => {});
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
 * Async so a rescan of a large Custom Scenery folder (ortho packs hold
 * thousands of DSF tiles) never blocks the main process.
 */
export async function scanSceneryFolder(folderPath: string): Promise<SceneryClassification> {
  const classification = createDefaultClassification();

  // Security: basic path validation
  if (!folderPath || folderPath.includes('..')) {
    return classification;
  }

  try {
    const entries = await fs.promises.readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      const lowerName = entry.name.toLowerCase();

      if (await isFileEntry(entry, folderPath)) {
        // Check for library.txt and parse exports
        if (lowerName === 'library.txt') {
          classification.hasLibraryTxt = true;
          classification.libraryExports = await parseLibraryExports(entryPath);
        }

        // Check for plugin files
        if (lowerName.endsWith('.xpl')) {
          classification.hasPlugins = true;
        }
      }

      if (await isDirectoryEntry(entry, folderPath)) {
        // Check for Earth nav data folder
        if (lowerName === 'earth nav data') {
          classification.hasEarthNavData = true;

          // Search for apt.dat and DSF files inside Earth nav data
          const earthNavResult = await scanEarthNavData(entryPath);
          classification.hasAptDat = earthNavResult.hasAptDat;
          classification.hasDsf = earthNavResult.hasDsf;
          classification.dsfCount = earthNavResult.dsfCount;
          classification.dsfFilenames = earthNavResult.dsfFilenames;

          if (earthNavResult.firstDsfPath) {
            classification.dsfInfo = parseDsfHeader(earthNavResult.firstDsfPath);
          }
        }

        // Also check for plugins in subdirectories (one level)
        if (lowerName === 'plugins') {
          classification.hasPlugins = await hasPluginFiles(entryPath);
        }
      }
    }
  } catch {
    // Return default classification on error
  }

  return classification;
}

interface EarthNavScanResult {
  hasAptDat: boolean;
  hasDsf: boolean;
  firstDsfPath: string;
  dsfCount: number;
  dsfFilenames: string[];
}

async function scanEarthNavData(earthNavPath: string): Promise<EarthNavScanResult> {
  const result: EarthNavScanResult = {
    hasAptDat: false,
    hasDsf: false,
    firstDsfPath: '',
    dsfCount: 0,
    dsfFilenames: [],
  };

  async function scan(dir: string, depth: number): Promise<void> {
    if (depth > MAX_APT_DAT_DEPTH) return;

    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const lowerName = entry.name.toLowerCase();

        if (await isFileEntry(entry, dir)) {
          if (lowerName === 'apt.dat' && (await isValidAptDat(entryPath))) {
            result.hasAptDat = true;
          }

          if (lowerName.endsWith('.dsf')) {
            result.hasDsf = true;
            result.dsfCount++;
            result.dsfFilenames.push(entry.name);
            if (!result.firstDsfPath) {
              result.firstDsfPath = entryPath;
            }
          }
        }

        if ((await isDirectoryEntry(entry, dir)) && depth < MAX_DSF_SEARCH_DEPTH) {
          await scan(entryPath, depth + 1);
        }
      }
    } catch {
      // Ignore errors in subdirectories
    }
  }

  await scan(earthNavPath, 0);
  return result;
}

async function hasPluginFiles(pluginsPath: string): Promise<boolean> {
  try {
    const entries = await fs.promises.readdir(pluginsPath, { withFileTypes: true });
    for (const entry of entries) {
      if ((await isFileEntry(entry, pluginsPath)) && entry.name.toLowerCase().endsWith('.xpl')) {
        return true;
      }
    }
  } catch {
    // Ignore
  }
  return false;
}
