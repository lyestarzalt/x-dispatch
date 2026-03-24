import * as fs from 'fs';
import * as path from 'path';
import type { LuaScriptInfo } from '../../core/types';

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
 * Scan FlyWithLua/Scripts for lua scripts.
 */
export function scanLuaScripts(xplanePath: string): LuaScriptInfo[] {
  const scriptsDir = path.join(xplanePath, 'Resources', 'plugins', 'FlyWithLua', 'Scripts');

  if (!fs.existsSync(scriptsDir)) return [];

  const results: LuaScriptInfo[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(scriptsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!isFileEntry(entry, scriptsDir)) continue;

    const ext = path.extname(entry.name).toLowerCase();

    if (ext === '.lua') {
      results.push({
        fileName: entry.name,
        displayName: path.basename(entry.name, ext),
        enabled: true,
      });
    } else if (ext === '.xfml') {
      results.push({
        fileName: entry.name,
        displayName: path.basename(entry.name, ext),
        enabled: false,
      });
    }
  }

  // Sort alphabetically
  return results.sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
  );
}
