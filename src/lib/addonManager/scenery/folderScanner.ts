// src/lib/addonManager/scenery/folderScanner.ts
import * as fs from 'fs';
import * as path from 'path';
import { parseDsfHeader } from '../core/dsfParser';
import { type SceneryClassification, createDefaultClassification } from '../core/types';

const MAX_APT_DAT_DEPTH = 5;
const MAX_DSF_SEARCH_DEPTH = 3;

/**
 * Scan a scenery folder to determine its classification markers.
 * Single-pass scan that checks for:
 * - library.txt
 * - Earth nav data/ folder
 * - apt.dat (up to 5 levels deep in Earth nav data)
 * - *.xpl plugin files
 * - *.dsf files (parses first one found for header info)
 */
export function scanSceneryFolder(folderPath: string): SceneryClassification {
  const classification = createDefaultClassification();

  // Security: basic path validation
  if (!folderPath || folderPath.includes('..')) {
    return classification;
  }

  if (!fs.existsSync(folderPath)) {
    return classification;
  }

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      const lowerName = entry.name.toLowerCase();

      if (entry.isFile()) {
        // Check for library.txt
        if (lowerName === 'library.txt') {
          classification.hasLibraryTxt = true;
        }

        // Check for plugin files
        if (lowerName.endsWith('.xpl')) {
          classification.hasPlugins = true;
        }
      }

      if (entry.isDirectory()) {
        // Check for Earth nav data folder
        if (lowerName === 'earth nav data') {
          classification.hasEarthNavData = true;

          // Search for apt.dat and DSF files inside Earth nav data
          const earthNavResult = scanEarthNavData(entryPath);
          classification.hasAptDat = earthNavResult.hasAptDat;
          classification.hasDsf = earthNavResult.hasDsf;

          if (earthNavResult.firstDsfPath) {
            classification.dsfInfo = parseDsfHeader(earthNavResult.firstDsfPath);
          }
        }

        // Also check for plugins in subdirectories (one level)
        if (lowerName === 'plugins') {
          classification.hasPlugins = hasPluginFiles(entryPath);
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
}

function scanEarthNavData(earthNavPath: string): EarthNavScanResult {
  const result: EarthNavScanResult = {
    hasAptDat: false,
    hasDsf: false,
    firstDsfPath: '',
  };

  function scan(dir: string, depth: number): void {
    if (depth > MAX_APT_DAT_DEPTH) return;

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const entryPath = path.join(dir, entry.name);
        const lowerName = entry.name.toLowerCase();

        if (entry.isFile()) {
          if (lowerName === 'apt.dat') {
            result.hasAptDat = true;
          }

          if (lowerName.endsWith('.dsf')) {
            result.hasDsf = true;
            if (!result.firstDsfPath) {
              result.firstDsfPath = entryPath;
            }
          }
        }

        if (entry.isDirectory() && depth < MAX_DSF_SEARCH_DEPTH) {
          scan(entryPath, depth + 1);
        }
      }
    } catch {
      // Ignore errors in subdirectories
    }
  }

  scan(earthNavPath, 0);
  return result;
}

function hasPluginFiles(pluginsPath: string): boolean {
  try {
    const entries = fs.readdirSync(pluginsPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.toLowerCase().endsWith('.xpl')) {
        return true;
      }
    }
  } catch {
    // Ignore
  }
  return false;
}
