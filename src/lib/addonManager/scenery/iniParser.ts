import * as fs from 'fs';
import * as path from 'path';
import {
  type ParsedIni,
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

const PLATFORM_MARKERS = ['I', 'A'];
const VERSION_LINE = /^\d+\s+Version$/;
const SCENERY_LINE = 'SCENERY';

/**
 * Normalize a path as written in the INI: forward slashes, no trailing slash.
 * The result is what gets written back, so nested paths survive a round trip.
 */
export function normalizeIniPath(raw: string): string {
  return raw.replace(/\\/g, '/').trim().replace(/\/+$/, '');
}

/**
 * X-Plane accepts both `Custom Scenery/Foo` and `D:/Scenery/Foo`.
 * `path.isAbsolute` only recognizes the host platform's form, so check both.
 */
export function isAbsoluteIniPath(sceneryPath: string): boolean {
  return /^([a-zA-Z]:[/\\]|[/\\])/.test(sceneryPath);
}

/**
 * X-Plane writes `I` / `1000 Version` / `SCENERY` before the pack list.
 * Re-add whichever of those is missing without disturbing anything else.
 */
function normalizeHeader(header: string[]): string[] {
  const lines = [...header];
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop();
  }

  if (!lines.some((l) => PLATFORM_MARKERS.includes(l.trim()))) {
    lines.unshift('I');
  }
  if (!lines.some((l) => VERSION_LINE.test(l.trim()))) {
    lines.splice(1, 0, '1000 Version');
  }
  if (!lines.some((l) => l.trim() === SCENERY_LINE)) {
    lines.push(SCENERY_LINE);
  }

  return lines;
}

/**
 * Read the header of an existing scenery_packs.ini so a rewrite can preserve it.
 * Returns the X-Plane default header when the file is missing or headerless.
 */
export function readIni(iniPath: string): Result<ParsedIni, SceneryError> {
  if (!fs.existsSync(iniPath)) {
    return err({ code: 'INI_NOT_FOUND', path: iniPath });
  }

  let content: string;
  try {
    content = fs.readFileSync(iniPath, 'utf-8');
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'INI_PARSE_ERROR', line: 0, content: message });
  }

  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const lines = content.split(/\r?\n/);

  const header: string[] = [];
  const entries: ParsedIniEntry[] = [];
  let seenPack = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const isPack =
      line.startsWith(SCENERY_PACK_PREFIX) || line.startsWith(SCENERY_PACK_DISABLED_PREFIX);

    if (!isPack) {
      if (!seenPack) header.push(rawLine);
      continue;
    }
    seenPack = true;

    const enabled = !line.startsWith(SCENERY_PACK_DISABLED_PREFIX);
    const prefixLength = enabled ? SCENERY_PACK_PREFIX.length : SCENERY_PACK_DISABLED_PREFIX.length;
    const sceneryPath = normalizeIniPath(line.slice(prefixLength));

    if (sceneryPath === '') continue;

    if (sceneryPath === GLOBAL_AIRPORTS_MARKER) {
      entries.push({
        sceneryPath: GLOBAL_AIRPORTS_MARKER,
        fullPath: '',
        enabled,
        isAbsolute: false,
        isGlobalAirports: true,
        originalLine: line,
      });
      continue;
    }

    const isAbsolute = isAbsoluteIniPath(sceneryPath);
    const xplaneRoot = path.dirname(path.dirname(iniPath));
    const resolvedFull = path.resolve(
      isAbsolute ? sceneryPath : path.join(xplaneRoot, sceneryPath)
    );

    if (!isAbsolute) {
      const resolvedRoot = path.resolve(xplaneRoot);
      if (!resolvedFull.startsWith(resolvedRoot + path.sep)) {
        continue; // Relative entry escaping the X-Plane folder
      }
    }

    entries.push({
      sceneryPath,
      fullPath: resolvedFull,
      enabled,
      isAbsolute,
      isGlobalAirports: false,
      originalLine: line,
    });
  }

  return ok({ header: normalizeHeader(header), entries, eol });
}

/**
 * Parse scenery_packs.ini into entries, discarding the header.
 */
export function parseSceneryPacksIni(iniPath: string): Result<ParsedIniEntry[], SceneryError> {
  const result = readIni(iniPath);
  return result.ok ? ok(result.value.entries) : result;
}

export interface WriteIniOptions {
  header?: string[];
  eol?: string;
}

/**
 * Write scenery entries back to scenery_packs.ini.
 * Writes to a sibling temp file and renames, so an interrupted write cannot
 * leave the user with a truncated INI.
 */
export function writeSceneryPacksIni(
  iniPath: string,
  entries: SceneryEntry[],
  options: WriteIniOptions = {}
): Result<void, SceneryError> {
  const header = normalizeHeader(options.header ?? []);
  const eol = options.eol ?? '\n';

  const lines = [...header, ''];

  for (const entry of entries) {
    const prefix = entry.enabled ? SCENERY_PACK_PREFIX : SCENERY_PACK_DISABLED_PREFIX;
    if (entry.isGlobalAirports) {
      lines.push(`${prefix}${GLOBAL_AIRPORTS_MARKER}`);
    } else {
      lines.push(`${prefix}${entry.sceneryPath}/`);
    }
  }

  const tempPath = `${iniPath}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tempPath, lines.join(eol) + eol, 'utf-8');
    fs.renameSync(tempPath, iniPath);
    return ok(undefined);
  } catch (e) {
    try {
      fs.rmSync(tempPath, { force: true });
    } catch {
      // Best effort
    }
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'WRITE_FAILED', path: iniPath, reason: message });
  }
}

const MAX_BACKUPS = 10;

/**
 * Create a backup of scenery_packs.ini.
 * Returns the backup file path.
 * Automatically cleans up old backups, keeping only the last MAX_BACKUPS.
 */
export function backupSceneryPacksIni(
  iniPath: string,
  backupDir: string
): Result<string, SceneryError> {
  if (!fs.existsSync(iniPath)) {
    return err({ code: 'INI_NOT_FOUND', path: iniPath });
  }

  try {
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `scenery_packs_${timestamp}.ini`);

    fs.copyFileSync(iniPath, backupPath);
    cleanupOldBackups(backupDir);

    return ok(backupPath);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return err({ code: 'BACKUP_FAILED', reason: message });
  }
}

/**
 * Remove old backups, keeping only the most recent MAX_BACKUPS files.
 */
function cleanupOldBackups(backupDir: string): void {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith('scenery_packs_') && f.endsWith('.ini'))
      .map((f) => ({
        name: f,
        path: path.join(backupDir, f),
        mtime: fs.statSync(path.join(backupDir, f)).mtime.getTime(),
      }))
      .sort((a, b) => b.mtime - a.mtime);

    for (let i = MAX_BACKUPS; i < files.length; i++) {
      const file = files[i];
      if (file) fs.unlinkSync(file.path);
    }
  } catch {
    // Ignore cleanup errors - not critical
  }
}
