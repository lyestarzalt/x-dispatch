import * as fs from 'fs';
import * as path from 'path';
import type { VersionData } from '../../core/types';

/**
 * Read version from skunkcrafts_updater.cfg or version files.
 * Priority: skunkcrafts_updater.cfg > version files > digit parsing
 */
export function detectVersion(
  updaterCfgPath: string | undefined,
  versionFilePaths: string[]
): VersionData | undefined {
  // Priority 1: skunkcrafts_updater.cfg
  if (updaterCfgPath && fs.existsSync(updaterCfgPath)) {
    const result = parseSkunkCraftsCfg(updaterCfgPath);
    if (result) return result;
  }

  // Priority 2: Version files
  for (const filePath of versionFilePaths) {
    const result = parseVersionFile(filePath);
    if (result) return result;
  }

  return undefined;
}

/**
 * Parse skunkcrafts_updater.cfg format:
 * version|1.4.2
 * module|https://example.com/updates
 * disabled|false
 */
function parseSkunkCraftsCfg(cfgPath: string): VersionData | undefined {
  try {
    const content = fs.readFileSync(cfgPath, 'utf-8');
    let version: string | undefined;
    let updateUrl: string | undefined;
    let cfgDisabled: boolean | undefined;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('version|')) {
        version = trimmed.slice('version|'.length).trim();
      }
      if (trimmed.startsWith('module|')) {
        updateUrl = trimmed.slice('module|'.length).trim();
      }
      if (trimmed.startsWith('disabled|')) {
        cfgDisabled = trimmed.slice('disabled|'.length).trim().toLowerCase() === 'true';
      }
    }

    if (version) {
      return { version, updateUrl, cfgDisabled };
    }
  } catch {
    // Ignore read errors
  }
  return undefined;
}

/**
 * Parse version from a generic version file.
 */
function parseVersionFile(filePath: string): VersionData | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf-8').trim();

    // Try semver-like pattern: 1.2.3, 1.2.3-beta, etc.
    const semverMatch = content.match(/(\d+\.\d+[.\d]*\S*)/);
    if (semverMatch?.[1]) {
      return { version: semverMatch[1] };
    }

    // Try digit-only format: "020310" -> "2.3.10"
    const digitVersion = parseDigitVersion((content.split('\n')[0] ?? '').trim());
    if (digitVersion) {
      return { version: digitVersion };
    }

    // Fallback: first non-empty line
    const firstLine = content.split('\n').find((l) => l.trim().length > 0);
    if (firstLine && firstLine.trim().length < 50) {
      return { version: firstLine.trim() };
    }
  } catch {
    // Ignore read errors
  }
  return undefined;
}

/**
 * Parse digit-only version: "020310" -> "2.3.10"
 * Splits into 2-char chunks, parses as numbers.
 */
function parseDigitVersion(input: string): string | undefined {
  const digits = input.replace(/\D/g, '');
  if (digits.length < 4) return undefined;

  const chunks: number[] = [];
  for (let i = 0; i < digits.length; i += 2) {
    const chunk = digits.substring(i, i + 2);
    chunks.push(parseInt(chunk, 10));
  }

  if (chunks.length < 2) return undefined;
  return chunks.join('.');
}

/**
 * Find skunkcrafts_updater.cfg in a folder.
 */
export function findUpdaterCfg(folderPath: string): string | undefined {
  const cfgPath = path.join(folderPath, 'skunkcrafts_updater.cfg');
  return fs.existsSync(cfgPath) ? cfgPath : undefined;
}

/**
 * Find version files in a folder.
 */
export function findVersionFiles(folderPath: string): string[] {
  const versionFiles: string[] = [];

  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const lower = entry.name.toLowerCase();
      if (lower.includes('version') || lower === '757.ini' || lower === '767.ini') {
        versionFiles.push(path.join(folderPath, entry.name));
      }
    }
  } catch {
    // Ignore
  }

  return versionFiles;
}
