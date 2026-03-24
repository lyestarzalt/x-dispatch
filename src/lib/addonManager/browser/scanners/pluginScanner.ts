import * as fs from 'fs';
import * as path from 'path';
import type { PluginInfo } from '../../core/types';
import { detectVersion, findUpdaterCfg, findVersionFiles } from '../version/detector';

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

const MAX_XPL_SEARCH_DEPTH = 3;

/**
 * Scan Resources/plugins/ for installed plugins.
 */
export function scanPlugins(xplanePath: string): PluginInfo[] {
  const pluginsDir = path.join(xplanePath, 'Resources', 'plugins');
  if (!fs.existsSync(pluginsDir)) return [];

  const results: PluginInfo[] = [];

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(pluginsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!isDirEntry(entry, pluginsDir) || entry.name.startsWith('.')) continue;

    const pluginPath = path.join(pluginsDir, entry.name);
    const info = scanSinglePluginFolder(pluginPath, entry.name);
    if (info) results.push(info);
  }

  // Sort alphabetically
  return results.sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
  );
}

/**
 * Scan a single plugin folder.
 */
function scanSinglePluginFolder(pluginPath: string, folderName: string): PluginInfo | undefined {
  const { xplFiles, xfmpFiles } = findXplFiles(pluginPath, MAX_XPL_SEARCH_DEPTH);

  if (xplFiles.length === 0 && xfmpFiles.length === 0) return undefined;

  const enabled = xplFiles.length > 0;
  const allFiles = enabled ? xplFiles : xfmpFiles;
  const platform = detectPlatform(allFiles);

  // Version detection
  const updaterCfg = findUpdaterCfg(pluginPath);
  const versionFiles = findVersionFiles(pluginPath);
  const versionData = detectVersion(updaterCfg, versionFiles);

  // FlyWithLua special case
  let hasScripts = false;
  let scriptCount = 0;
  if (folderName.toLowerCase() === 'flywithlua') {
    const scriptsDir = path.join(pluginPath, 'Scripts');
    if (fs.existsSync(scriptsDir)) {
      try {
        const scripts = fs
          .readdirSync(scriptsDir, { withFileTypes: true })
          .filter(
            (e) =>
              isFileEntry(e, scriptsDir) &&
              ['.lua', '.xfml'].includes(path.extname(e.name).toLowerCase())
          );
        hasScripts = scripts.length > 0;
        scriptCount = scripts.length;
      } catch {
        // Ignore
      }
    }
  }

  return {
    folderName,
    displayName: folderName,
    xplFiles: allFiles,
    enabled,
    platform,
    version: versionData?.version,
    updateUrl: versionData?.updateUrl,
    latestVersion: undefined,
    hasUpdate: false,
    locked: false,
    hasScripts,
    scriptCount,
    cfgDisabled: versionData?.cfgDisabled,
  };
}

/**
 * Find .xpl and .xfmp files recursively up to maxDepth.
 */
function findXplFiles(dir: string, maxDepth: number): { xplFiles: string[]; xfmpFiles: string[] } {
  const xplFiles: string[] = [];
  const xfmpFiles: string[] = [];

  function walk(currentDir: string, depth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.relative(dir, fullPath);

      if (isFileEntry(entry, currentDir)) {
        const ext = path.extname(entry.name).toLowerCase();
        if (ext === '.xpl') xplFiles.push(relativePath);
        if (ext === '.xfmp') xfmpFiles.push(relativePath);
      }
      if (isDirEntry(entry, currentDir)) {
        walk(fullPath, depth + 1);
      }
    }
  }

  walk(dir, 0);
  return { xplFiles, xfmpFiles };
}

/**
 * Detect platform from xpl file paths.
 */
function detectPlatform(xplFiles: string[]): 'win' | 'mac' | 'lin' | 'multi' | 'unknown' {
  const platforms = new Set<string>();

  for (const file of xplFiles) {
    const lower = file.toLowerCase();
    const parts = lower.split(/[/\\]/);

    for (const part of parts) {
      if (part === 'win' || part === 'win_x64' || part.includes('win')) {
        platforms.add('win');
      }
      if (part === 'mac' || part === 'mac_x64' || part.includes('mac')) {
        platforms.add('mac');
      }
      if (part === 'lin' || part === 'lin_x64' || part.includes('lin')) {
        platforms.add('lin');
      }
    }
  }

  if (platforms.size >= 2) return 'multi';
  if (platforms.size === 1) return [...platforms][0] as 'win' | 'mac' | 'lin';
  return 'unknown';
}
