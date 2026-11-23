import * as fs from 'fs';
import * as path from 'path';

/**
 * Directory-entry checks that follow symlinks. `Dirent.isDirectory()` and
 * `isFile()` are false for a symlink, and X-Plane users link aircraft and
 * scenery folders in from other disks, so a scan has to stat the target.
 * A broken link counts as neither. Main process only.
 */
export async function isDirEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
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

export async function isFileEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
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

export function isDirEntrySync(entry: fs.Dirent, parentPath: string): boolean {
  if (entry.isDirectory()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return fs.statSync(path.join(parentPath, entry.name)).isDirectory();
    } catch {
      return false;
    }
  }
  return false;
}

export function isFileEntrySync(entry: fs.Dirent, parentPath: string): boolean {
  if (entry.isFile()) return true;
  if (entry.isSymbolicLink()) {
    try {
      return fs.statSync(path.join(parentPath, entry.name)).isFile();
    } catch {
      return false;
    }
  }
  return false;
}

/** Modification time in whole milliseconds, or null when the file cannot be read. */
export function getFileMtime(filePath: string): number | null {
  try {
    const stat = fs.statSync(filePath);
    return Math.floor(stat.mtimeMs);
  } catch {
    return null;
  }
}
