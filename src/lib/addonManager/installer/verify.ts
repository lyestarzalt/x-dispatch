/**
 * Post-install checks. Extraction tools already verify each file's content (yauzl
 * checks sizes, 7-Zip and unrar check CRCs), so what is left to prove is placement:
 * the add-on's marker files exist where X-Plane will look, and every file the
 * archive listed sits in the final folder at its full size.
 */
import * as fs from 'fs';
import * as path from 'path';
import { normalizeEntryPath, resolveEntryTarget } from './extraction/options';
import type { AddonType, ArchiveEntry, VerificationStats } from './types';

/** A file the archive promised that is not in place after the move. */
export interface MisplacedFile {
  /** Path relative to the install folder, with `/` separators. */
  relative: string;
  /** The archive entry it came from, for a targeted re-extraction. */
  entryPath: string;
  reason: 'missing' | 'size';
  fromVariant?: boolean;
}

export interface ExpectedFile {
  relative: string;
  entryPath: string;
  size: number;
  /** The file comes from the chosen variant, not from the base listing. */
  fromVariant?: boolean;
}

/** Why an add-on's folder does not look like one of its type. */
export type MarkerProblem = 'empty' | 'noAcf' | 'noEarthNavData' | 'noNavFiles' | 'noXpl' | 'noLua';

const MARKER_DEPTH: Record<string, number> = { acf: 3, nav: 5, xpl: 4, lua: 2 };

/**
 * The files the archive will leave in the install folder: every non-directory
 * entry that survives the same path rules the extractors apply.
 */
export function expectedFiles(
  entries: ArchiveEntry[],
  options: { internalRoot?: string; exclude?: string[] }
): ExpectedFile[] {
  const expected: ExpectedFile[] = [];
  const exclude = (options.exclude ?? []).map(normalizeEntryPath);
  for (const entry of entries) {
    if (entry.isDirectory || entry.path.endsWith('/')) continue;
    const normalized = normalizeEntryPath(entry.path);
    if (exclude.some((prefix) => normalized.startsWith(prefix))) continue;
    const relative = resolveEntryTarget(entry.path, options);
    if (!relative) continue;
    expected.push({ relative, entryPath: entry.path, size: entry.uncompressedSize });
  }
  return expected;
}

/** The listing with a variant's replacements in place of the base files they overwrite. */
export function withVariant(
  expected: ExpectedFile[],
  variant: { files: Array<{ source: string; destination: string; size: number }> }
): ExpectedFile[] {
  const replaced = new Map(variant.files.map((file) => [file.destination, file]));
  const kept = expected.filter((file) => !replaced.has(file.relative));
  for (const file of variant.files) {
    kept.push({
      relative: file.destination,
      entryPath: file.source,
      size: file.size,
      fromVariant: true,
    });
  }
  return kept;
}

/** Stat every expected file in `targetDir`; a missing or short file is misplaced. */
export async function verifyPlacement(
  targetDir: string,
  expected: ExpectedFile[]
): Promise<{ stats: VerificationStats; misplaced: MisplacedFile[] }> {
  const misplaced: MisplacedFile[] = [];
  for (const file of expected) {
    const full = path.join(targetDir, ...file.relative.split('/'));
    try {
      const stat = await fs.promises.stat(full);
      if (stat.size !== file.size) {
        misplaced.push({
          relative: file.relative,
          entryPath: file.entryPath,
          reason: 'size',
          fromVariant: file.fromVariant,
        });
      }
    } catch {
      misplaced.push({
        relative: file.relative,
        entryPath: file.entryPath,
        reason: 'missing',
        fromVariant: file.fromVariant,
      });
    }
  }
  return {
    stats: {
      totalFiles: expected.length,
      verifiedFiles: expected.length - misplaced.length,
      failedFiles: misplaced.length,
      skippedFiles: 0,
    },
    misplaced,
  };
}

/** Whether a file with this extension exists under `dir`, at most `depth` levels down. */
async function hasFileWithExtension(dir: string, ext: string, depth: number): Promise<boolean> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  for (const entry of entries) {
    if (entry.isFile() && entry.name.toLowerCase().endsWith(ext)) return true;
  }
  if (depth <= 1) return false;
  for (const entry of entries) {
    if (
      entry.isDirectory() &&
      (await hasFileWithExtension(path.join(dir, entry.name), ext, depth - 1))
    ) {
      return true;
    }
  }
  return false;
}

async function hasAnyFile(dir: string, depth: number): Promise<boolean> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  if (entries.some((entry) => entry.isFile())) return true;
  if (depth <= 1) return false;
  for (const entry of entries) {
    if (entry.isDirectory() && (await hasAnyFile(path.join(dir, entry.name), depth - 1)))
      return true;
  }
  return false;
}

/**
 * The files X-Plane needs to recognise an add-on of this type, checked on the
 * extracted folder before it is moved into place. Null means the folder passes.
 */
export async function verifyMarkers(
  dir: string,
  addonType: AddonType
): Promise<MarkerProblem | null> {
  if (!(await hasAnyFile(dir, 6))) return 'empty';
  switch (addonType) {
    case 'Aircraft':
      return (await hasFileWithExtension(dir, '.acf', MARKER_DEPTH.acf!)) ? null : 'noAcf';
    case 'Scenery': {
      const navData = path.join(dir, 'Earth nav data');
      if (!fs.existsSync(navData)) return 'noEarthNavData';
      // A Gateway airport ships apt.dat and no tiles; a mesh ships tiles and no apt.dat.
      if (fs.existsSync(path.join(navData, 'apt.dat'))) return null;
      return (await hasFileWithExtension(navData, '.dsf', MARKER_DEPTH.nav!)) ? null : 'noNavFiles';
    }
    case 'SceneryLibrary':
      return fs.existsSync(path.join(dir, 'library.txt')) ||
        fs.existsSync(path.join(dir, 'Earth nav data'))
        ? null
        : 'noNavFiles';
    case 'Plugin':
      return (await hasFileWithExtension(dir, '.xpl', MARKER_DEPTH.xpl!)) ? null : 'noXpl';
    case 'LuaScript':
      return (await hasFileWithExtension(dir, '.lua', MARKER_DEPTH.lua!)) ? null : 'noLua';
    case 'Livery':
    case 'Navdata':
      return null;
  }
}

/** File count and total bytes of a tree, for proving a backup is complete before deleting. */
export async function treeSummary(dir: string): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;
  const walk = async (current: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        files++;
        bytes += (await fs.promises.stat(full)).size;
      }
    }
  };
  await walk(dir);
  return { files, bytes };
}
