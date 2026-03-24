import * as fs from 'fs';
import * as path from 'path';
import type { BrowserError, LiveryInfo, Result } from '../../core/types';
import { err, ok } from '../../core/types';

function isDirEntry(entry: fs.Dirent, parentPath: string): boolean {
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

function isFileEntry(entry: fs.Dirent, parentPath: string): boolean {
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

/**
 * Scan liveries for a specific aircraft.
 */
export function scanLiveries(
  xplanePath: string,
  aircraftFolder: string
): Result<LiveryInfo[], BrowserError> {
  // Security: validate input
  if (!aircraftFolder || aircraftFolder.length > 500) {
    return err({ code: 'INVALID_INPUT', field: 'aircraftFolder' });
  }
  if (aircraftFolder.includes('..')) {
    return err({ code: 'PATH_TRAVERSAL', path: aircraftFolder });
  }

  const aircraftRoot = path.join(xplanePath, 'Aircraft');
  const liveriesDir = path.join(aircraftRoot, aircraftFolder, 'liveries');

  // Defense-in-depth: validate resolved path
  const resolvedLiveries = path.resolve(liveriesDir);
  const resolvedRoot = path.resolve(aircraftRoot);
  if (!resolvedLiveries.startsWith(resolvedRoot + path.sep)) {
    return err({ code: 'PATH_TRAVERSAL', path: aircraftFolder });
  }

  if (!fs.existsSync(resolvedLiveries)) {
    return ok([]);
  }

  const results: LiveryInfo[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolvedLiveries, { withFileTypes: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'SCAN_FAILED', path: resolvedLiveries, reason: message });
  }

  for (const entry of entries) {
    if (!isDirEntry(entry, resolvedLiveries)) continue;

    const liveryPath = path.join(resolvedLiveries, entry.name);
    const iconPath = findLiveryIcon(liveryPath);

    results.push({
      folderName: entry.name,
      displayName: entry.name,
      iconPath,
    });
  }

  // Sort alphabetically
  return ok(
    results.sort((a, b) => a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase()))
  );
}

/**
 * Find livery icon.
 * Priority: {cfg_stem}_icon11.png > any *_icon11.png
 */
function findLiveryIcon(liveryPath: string): string | undefined {
  let files: fs.Dirent[];
  try {
    files = fs
      .readdirSync(liveryPath, { withFileTypes: true })
      .filter((e) => isFileEntry(e, liveryPath));
  } catch {
    return undefined;
  }

  // Priority 1: Match from .cfg file stem
  for (const file of files) {
    if (path.extname(file.name).toLowerCase() === '.cfg') {
      const stem = path.basename(file.name, '.cfg');
      const iconName = `${stem}_icon11.png`;
      const iconPath = path.join(liveryPath, iconName);
      if (fs.existsSync(iconPath)) {
        return iconPath;
      }
    }
  }

  // Priority 2: Any *_icon11.png
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('_icon11.png')) {
      return path.join(liveryPath, file.name);
    }
  }

  return undefined;
}
