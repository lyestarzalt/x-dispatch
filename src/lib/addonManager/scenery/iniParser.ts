import * as fs from 'fs';
import * as path from 'path';
import {
  type ParsedIniEntry,
  type Result,
  type SceneryEntry,
  type SceneryError,
  err,
  ok,
} from '../core/types';

const SCENERY_PACK_PREFIX = 'SCENERY_PACK ';
const SCENERY_PACK_DISABLED_PREFIX = 'SCENERY_PACK_DISABLED ';
const GLOBAL_AIRPORTS_MARKER = '*GLOBAL_AIRPORTS*';

/**
 * Parse scenery_packs.ini file into entries.
 * Skips comments, empty lines, and the I/A header lines.
 */
export function parseSceneryPacksIni(
  iniPath: string,
  customSceneryPath: string
): Result<ParsedIniEntry[], SceneryError> {
  if (!fs.existsSync(iniPath)) {
    return err({ code: 'INI_NOT_FOUND', path: iniPath });
  }

  const content = fs.readFileSync(iniPath, 'utf-8');
  const lines = content.split('\n');
  const entries: ParsedIniEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and header
    if (line === '' || line === 'I' || line === 'A' || line.startsWith('1000')) {
      continue;
    }

    let enabled = true;
    let sceneryPath = '';

    if (line.startsWith(SCENERY_PACK_DISABLED_PREFIX)) {
      enabled = false;
      sceneryPath = line.slice(SCENERY_PACK_DISABLED_PREFIX.length).trim();
    } else if (line.startsWith(SCENERY_PACK_PREFIX)) {
      enabled = true;
      sceneryPath = line.slice(SCENERY_PACK_PREFIX.length).trim();
    } else {
      // Unknown line format, skip
      continue;
    }

    // Remove trailing slash if present
    if (sceneryPath.endsWith('/')) {
      sceneryPath = sceneryPath.slice(0, -1);
    }

    // Check for *GLOBAL_AIRPORTS*
    if (sceneryPath === GLOBAL_AIRPORTS_MARKER) {
      entries.push({
        folderName: GLOBAL_AIRPORTS_MARKER,
        fullPath: '',
        enabled: true,
        isGlobalAirports: true,
        originalLine: line,
      });
      continue;
    }

    // Extract folder name from path (last component)
    const folderName = path.basename(sceneryPath);

    // Build full path - scenery paths are relative to X-Plane root
    // They look like: "Custom Scenery/FolderName/"
    const fullPath = path.join(path.dirname(customSceneryPath), sceneryPath);

    entries.push({
      folderName,
      fullPath,
      enabled,
      isGlobalAirports: false,
      originalLine: line,
    });
  }

  return ok(entries);
}

/**
 * Write sorted scenery entries back to scenery_packs.ini.
 * Inserts *GLOBAL_AIRPORTS* before first DefaultAirport entry.
 */
export function writeSceneryPacksIni(
  iniPath: string,
  entries: SceneryEntry[],
  globalAirportsInserted: boolean
): Result<void, SceneryError> {
  const lines: string[] = [];

  // Header
  lines.push('I');
  lines.push('1000 Version');
  lines.push('');

  let globalAirportsWritten = false;

  for (const entry of entries) {
    // Insert *GLOBAL_AIRPORTS* before first DefaultAirport if not already written
    if (
      !globalAirportsWritten &&
      globalAirportsInserted &&
      entry.priority >= 2 // DefaultAirport or lower
    ) {
      lines.push(`${SCENERY_PACK_PREFIX}${GLOBAL_AIRPORTS_MARKER}`);
      globalAirportsWritten = true;
    }

    const prefix = entry.enabled ? SCENERY_PACK_PREFIX : SCENERY_PACK_DISABLED_PREFIX;
    // Use relative path format: Custom Scenery/FolderName/
    lines.push(`${prefix}Custom Scenery/${entry.folderName}/`);
  }

  // If no DefaultAirport entries, append *GLOBAL_AIRPORTS* at end
  if (!globalAirportsWritten && globalAirportsInserted) {
    lines.push(`${SCENERY_PACK_PREFIX}${GLOBAL_AIRPORTS_MARKER}`);
  }

  try {
    fs.writeFileSync(iniPath, lines.join('\n') + '\n', 'utf-8');
    return ok(undefined);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'WRITE_FAILED', path: iniPath, reason: message });
  }
}

/**
 * Create a backup of scenery_packs.ini.
 * Returns the backup file path.
 */
export function backupSceneryPacksIni(
  iniPath: string,
  backupDir: string
): Result<string, SceneryError> {
  if (!fs.existsSync(iniPath)) {
    return err({ code: 'INI_NOT_FOUND', path: iniPath });
  }

  try {
    // Create backup directory if needed
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Generate backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `scenery_packs_${timestamp}.ini`);

    fs.copyFileSync(iniPath, backupPath);
    return ok(backupPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'BACKUP_FAILED', reason: message });
  }
}
