// src/lib/addonManager/browser/scanners/aircraftScanner.ts
import * as fs from 'fs';
import * as path from 'path';
import type { AircraftInfo } from '../../core/types';
import { detectVersion, findUpdaterCfg, findVersionFiles } from '../version/detector';

async function isDirEntry(entry: fs.Dirent, parentPath: string): Promise<boolean> {
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

const MAX_SCAN_DEPTH = 3;

/**
 * Scan Aircraft/ folder for installed aircraft.
 * Returns aircraft in alphabetical order by displayName.
 * Async so a rescan never blocks the main process.
 */
export async function scanAircraft(xplanePath: string): Promise<AircraftInfo[]> {
  const aircraftDir = path.join(xplanePath, 'Aircraft');
  if (!fs.existsSync(aircraftDir)) return [];

  const results: AircraftInfo[] = [];

  async function scanLevel(dir: string, depth: number): Promise<void> {
    if (depth > MAX_SCAN_DEPTH) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const subdirs: string[] = [];
    for (const entry of entries) {
      if ((await isDirEntry(entry, dir)) && !entry.name.startsWith('.')) {
        subdirs.push(path.join(dir, entry.name));
      }
    }

    for (const subdir of subdirs) {
      const aircraft = await scanSingleAircraftFolder(subdir, aircraftDir);
      if (aircraft) {
        results.push(aircraft);
      } else {
        // Not an aircraft folder, go deeper
        await scanLevel(subdir, depth + 1);
      }
    }
  }

  await scanLevel(aircraftDir, 0);

  // Sort alphabetically by displayName
  return results.sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
  );
}

/**
 * Scan a single folder to check if it's an aircraft.
 * Returns AircraftInfo if .acf or .xfma found, undefined otherwise.
 */
async function scanSingleAircraftFolder(
  folderPath: string,
  basePath: string
): Promise<AircraftInfo | undefined> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(folderPath, { withFileTypes: true });
  } catch {
    return undefined;
  }

  let acfFile: string | undefined;
  let xfmaFile: string | undefined;
  let iconPath: string | undefined;
  let hasLiveries = false;
  let liveryCount = 0;

  for (const entry of entries) {
    const lower = entry.name.toLowerCase();

    if (await isFileEntry(entry, folderPath)) {
      const ext = path.extname(lower);
      if (ext === '.acf' && !acfFile) {
        acfFile = entry.name;
      } else if (ext === '.xfma' && !xfmaFile) {
        xfmaFile = entry.name;
      }
      // Check for icon files (prefer icon11 over icon10, exact match or with prefix)
      if (lower.endsWith('_icon11.png') || lower === 'icon11.png') {
        iconPath = path.join(folderPath, entry.name);
      } else if (!iconPath && (lower.endsWith('_icon10.png') || lower === 'icon10.png')) {
        iconPath = path.join(folderPath, entry.name);
      }
    }

    if ((await isDirEntry(entry, folderPath)) && lower === 'liveries') {
      hasLiveries = true;
      const liveriesPath = path.join(folderPath, entry.name);
      try {
        const liveryEntries = await fs.promises.readdir(liveriesPath, { withFileTypes: true });
        let count = 0;
        for (const e of liveryEntries) {
          if (await isDirEntry(e, liveriesPath)) count++;
        }
        liveryCount = count;
      } catch {
        liveryCount = 0;
      }
    }
  }

  // Must have at least one .acf or .xfma
  if (!acfFile && !xfmaFile) return undefined;

  const enabled = acfFile !== undefined;
  const fileName = acfFile ?? xfmaFile!;
  const folderName = path.relative(basePath, folderPath);
  const displayName = path.basename(folderPath);

  // Detect version
  const updaterCfg = await findUpdaterCfg(folderPath);
  const versionFiles = await findVersionFiles(folderPath);
  const versionData = await detectVersion(updaterCfg, versionFiles);

  return {
    folderName,
    displayName,
    acfFile: fileName,
    enabled,
    hasLiveries,
    liveryCount,
    iconPath,
    version: versionData?.version,
    updateUrl: versionData?.updateUrl,
    latestVersion: undefined,
    hasUpdate: false,
    locked: false,
    cfgDisabled: versionData?.cfgDisabled,
  };
}
