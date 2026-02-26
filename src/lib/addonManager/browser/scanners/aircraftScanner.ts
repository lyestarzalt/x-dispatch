// src/lib/addonManager/browser/scanners/aircraftScanner.ts
import * as fs from 'fs';
import * as path from 'path';
import type { AircraftInfo } from '../../core/types';
import { detectVersion, findUpdaterCfg, findVersionFiles } from '../version/detector';

const MAX_SCAN_DEPTH = 3;

/**
 * Scan Aircraft/ folder for installed aircraft.
 * Returns aircraft in alphabetical order by displayName.
 */
export function scanAircraft(xplanePath: string): AircraftInfo[] {
  const aircraftDir = path.join(xplanePath, 'Aircraft');
  if (!fs.existsSync(aircraftDir)) return [];

  const results: AircraftInfo[] = [];

  function scanLevel(dir: string, depth: number): void {
    if (depth > MAX_SCAN_DEPTH) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const subdirs: string[] = [];
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        subdirs.push(path.join(dir, entry.name));
      }
    }

    for (const subdir of subdirs) {
      const aircraft = scanSingleAircraftFolder(subdir, aircraftDir);
      if (aircraft) {
        results.push(aircraft);
      } else {
        // Not an aircraft folder, go deeper
        scanLevel(subdir, depth + 1);
      }
    }
  }

  scanLevel(aircraftDir, 0);

  // Sort alphabetically by displayName
  return results.sort((a, b) =>
    a.displayName.toLowerCase().localeCompare(b.displayName.toLowerCase())
  );
}

/**
 * Scan a single folder to check if it's an aircraft.
 * Returns AircraftInfo if .acf or .xfma found, undefined otherwise.
 */
function scanSingleAircraftFolder(folderPath: string, basePath: string): AircraftInfo | undefined {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(folderPath, { withFileTypes: true });
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

    if (entry.isFile()) {
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

    if (entry.isDirectory() && lower === 'liveries') {
      hasLiveries = true;
      try {
        liveryCount = fs
          .readdirSync(path.join(folderPath, entry.name), { withFileTypes: true })
          .filter((e) => e.isDirectory()).length;
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
  const updaterCfg = findUpdaterCfg(folderPath);
  const versionFiles = findVersionFiles(folderPath);
  const versionData = detectVersion(updaterCfg, versionFiles);

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
