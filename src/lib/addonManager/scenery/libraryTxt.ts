/**
 * What a `library.txt` offers to the rest of the sim: the virtual paths its
 * EXPORT lines publish. Everything else in the file (regions, ratios, the real
 * file behind each export) does not matter for "is this library installed".
 */
import * as fs from 'fs';
import * as path from 'path';

/** OpenSceneryX's library.txt runs past a megabyte; anything beyond this is not a library. */
const MAX_LIBRARY_TXT_BYTES = 16 * 1024 * 1024;

/** The virtual paths exported by library.txt text, as written. */
export function parseLibraryExportLines(text: string): string[] {
  const exports: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('EXPORT')) continue;
    const tokens = line.split(/\s+/);
    const directive = tokens[0] ?? '';
    // EXPORT_RATIO puts a weight, and the X-Plane 12 *_SEASON forms a season list,
    // before the virtual path; every other EXPORT_* has it first
    const vpath =
      directive === 'EXPORT_RATIO' || directive.endsWith('_SEASON') ? tokens[2] : tokens[1];
    if (vpath) exports.push(vpath);
  }
  return exports;
}

/** The pack's library.txt, whatever its case: `Library.txt` ships too. */
export async function findLibraryTxt(packageDir: string): Promise<string | null> {
  try {
    const names = await fs.promises.readdir(packageDir);
    const name = names.find((n) => n.toLowerCase() === 'library.txt');
    return name ? path.join(packageDir, name) : null;
  } catch {
    return null;
  }
}

export async function readLibraryExports(filePath: string): Promise<string[]> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size > MAX_LIBRARY_TXT_BYTES) return [];
    return parseLibraryExportLines(await fs.promises.readFile(filePath, 'utf8'));
  } catch {
    return [];
  }
}
