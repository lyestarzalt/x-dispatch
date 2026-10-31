/**
 * A dropped folder listed the way an archive is, so type detection has one input.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { ArchiveEntry } from '../types';
import { IGNORE_PATTERNS, INSTALLER_CONSTANTS } from '../types';

/** Every file and folder under `dir`, as archive-style entries with `/` paths. */
export async function listDirectoryEntries(
  dir: string,
  maxDepth: number = INSTALLER_CONSTANTS.FOLDER_SCAN_MAX_DEPTH
): Promise<ArchiveEntry[]> {
  const entries: ArchiveEntry[] = [];

  const walk = async (current: string, relative: string, depth: number): Promise<void> => {
    if (depth > maxDepth) return;
    let children: fs.Dirent[];
    try {
      children = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const child of children) {
      if (IGNORE_PATTERNS.includes(child.name)) continue;
      const childRelative = relative ? `${relative}/${child.name}` : child.name;
      const childPath = path.join(current, child.name);
      if (child.isDirectory()) {
        entries.push({
          path: `${childRelative}/`,
          isDirectory: true,
          uncompressedSize: 0,
          compressedSize: 0,
          encrypted: false,
        });
        await walk(childPath, childRelative, depth + 1);
      } else if (child.isFile()) {
        let size = 0;
        try {
          size = (await fs.promises.stat(childPath)).size;
        } catch {
          // unreadable: counted as empty
        }
        entries.push({
          path: childRelative,
          isDirectory: false,
          uncompressedSize: size,
          compressedSize: size,
          encrypted: false,
        });
      }
    }
  };

  await walk(dir, '', 0);
  return entries;
}
