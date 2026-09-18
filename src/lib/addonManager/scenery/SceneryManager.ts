// src/lib/addonManager/scenery/SceneryManager.ts
import * as fs from 'fs';
import type { Dirent } from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { resolveLnkSync } from '@/lib/utils/resolveLnk';
import {
  type ParsedIni,
  type Result,
  type SceneryEntry,
  type SceneryError,
  SceneryPriority,
  createDefaultClassification,
  err,
  ok,
} from '../core/types';
import { classifyScenery } from './classifier';
import { scanSceneryFolder } from './folderScanner';
import {
  backupSceneryPacksIni,
  normalizeIniPath,
  readIni,
  writeSceneryPacksIni,
} from './iniParser';

const GLOBAL_AIRPORTS_MARKER = '*GLOBAL_AIRPORTS*';

/** Windows and macOS compare paths case-insensitively; Linux does not. */
function pathKey(fullPath: string): string {
  return process.platform === 'linux' ? fullPath : fullPath.toLowerCase();
}

/** Folders classified at once. High enough to keep the disk busy, low enough
 * to leave the event loop responsive between batches. */
const SCAN_CONCURRENCY = 8;

/** A scenery folder found but not yet classified. */
interface PendingEntry {
  sceneryPath: string;
  fullPath: string;
  enabled: boolean;
  /** Folder to classify, when it differs from fullPath (a .lnk target) */
  scanPath?: string;
  shortcutPath?: string;
  missing?: boolean;
  isGlobalAirports?: boolean;
}

/**
 * Resolve a path that points at a Windows shortcut to the folder it names.
 * Returns null for anything that is not a resolvable .lnk.
 */
function resolveShortcutTarget(fullPath: string): string | null {
  if (!fullPath.toLowerCase().endsWith('.lnk')) return null;
  try {
    if (!fs.statSync(fullPath).isFile()) return null;
    const resolved = resolveLnkSync(fullPath);
    if (resolved.ok && fs.existsSync(resolved.targetPath)) return resolved.targetPath;
  } catch {
    // Not resolvable; classification falls back to the original path
  }
  return null;
}

/**
 * Run an async mapper over a list, at most `limit` at a time, keeping order.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = next++;
      const item = items[index];
      if (index >= items.length || item === undefined) return;
      results[index] = await mapper(item, index);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Scan and classify one folder.
 * DefaultAirport tier is ONLY for the *GLOBAL_AIRPORTS* marker, not real folders.
 */
async function buildEntry(item: PendingEntry, index: number): Promise<SceneryEntry> {
  const displayName = item.isGlobalAirports
    ? GLOBAL_AIRPORTS_MARKER
    : path.basename(item.sceneryPath);

  if (item.isGlobalAirports || item.missing) {
    return {
      sceneryPath: item.sceneryPath,
      displayName,
      fullPath: item.fullPath,
      enabled: item.enabled,
      priority: item.isGlobalAirports
        ? SceneryPriority.DefaultAirport
        : SceneryPriority.Unrecognized,
      classification: createDefaultClassification(),
      originalIndex: index,
      ...(item.isGlobalAirports ? { isGlobalAirports: true } : { missing: true }),
    };
  }

  const classification = await scanSceneryFolder(item.scanPath ?? item.fullPath);

  return {
    sceneryPath: item.sceneryPath,
    displayName,
    fullPath: item.fullPath,
    enabled: item.enabled,
    priority: classifyScenery(displayName, classification),
    classification,
    originalIndex: index,
    ...(item.shortcutPath ? { shortcutPath: item.shortcutPath } : {}),
  };
}

export class SceneryManager {
  private readonly customSceneryPath: string;
  private readonly iniPath: string;
  private readonly backupDir: string;

  constructor(xplanePath: string) {
    this.customSceneryPath = path.join(xplanePath, 'Custom Scenery');
    this.iniPath = path.join(this.customSceneryPath, 'scenery_packs.ini');
    this.backupDir = path.join(xplanePath, 'Output', 'scenery_backups');
  }

  /**
   * Analyze all scenery: read INI, scan folders, classify.
   * Returns entries in INI file order (preserves user's custom order).
   * Use sort() explicitly if you want priority-based ordering.
   *
   * Folders are listed first and classified afterwards, a few at a time, so a
   * library of several thousand packs never blocks the main thread on one long
   * synchronous walk.
   */
  async analyze(): Promise<Result<SceneryEntry[], SceneryError>> {
    const iniResult = readIni(this.iniPath);
    if (!iniResult.ok) {
      return iniResult;
    }

    const pending: PendingEntry[] = [];
    const seen = new Set<string>();

    for (const iniEntry of iniResult.value.entries) {
      if (iniEntry.isGlobalAirports) {
        if (seen.has(GLOBAL_AIRPORTS_MARKER)) continue;
        seen.add(GLOBAL_AIRPORTS_MARKER);
        pending.push({
          sceneryPath: GLOBAL_AIRPORTS_MARKER,
          fullPath: '',
          enabled: iniEntry.enabled,
          isGlobalAirports: true,
        });
        continue;
      }

      if (seen.has(pathKey(iniEntry.fullPath))) continue;
      seen.add(pathKey(iniEntry.fullPath));

      // A pack the INI lists but disk no longer has is kept as `missing` so a
      // save writes the line back untouched. An external drive may just be
      // unplugged, and an entry the user still wants is not ours to drop.
      if (!fs.existsSync(iniEntry.fullPath)) {
        pending.push({
          sceneryPath: iniEntry.sceneryPath,
          fullPath: iniEntry.fullPath,
          enabled: iniEntry.enabled,
          missing: true,
        });
        continue;
      }

      // An INI entry may point straight at a .lnk file. Classify its target,
      // but keep the path the INI uses so the round trip stays byte-identical.
      const entry: PendingEntry = {
        sceneryPath: iniEntry.sceneryPath,
        fullPath: iniEntry.fullPath,
        enabled: iniEntry.enabled,
      };
      const target = resolveShortcutTarget(iniEntry.fullPath);
      if (target) {
        entry.scanPath = target;
        entry.shortcutPath = iniEntry.fullPath;
        // Claim the target too, so the directory walk does not list the same
        // scenery a second time under its resolved path.
        seen.add(pathKey(path.resolve(target)));
      }
      pending.push(entry);
    }

    await this.collectUnlistedFolders(pending, seen);

    return ok(
      await mapWithConcurrency(pending, SCAN_CONCURRENCY, (item, i) => buildEntry(item, i))
    );
  }

  /**
   * Add Custom Scenery folders the INI does not list yet.
   * They are shown in the UI; nothing is written until the user saves.
   */
  private async collectUnlistedFolders(pending: PendingEntry[], seen: Set<string>): Promise<void> {
    let dirEntries: Dirent[];
    try {
      dirEntries = await fsp.readdir(this.customSceneryPath, { withFileTypes: true });
    } catch {
      return; // Non-critical: X-Plane picks new folders up on its next launch
    }

    for (const dirEntry of dirEntries) {
      if (dirEntry.name.startsWith('.') || dirEntry.name === '__MACOSX') continue;

      if (dirEntry.isDirectory() || dirEntry.isSymbolicLink()) {
        const fullPath = path.resolve(path.join(this.customSceneryPath, dirEntry.name));
        if (seen.has(pathKey(fullPath))) continue;
        // A folder that only holds packs the INI already lists (an ortho tile
        // parent, say) is a container, not a scenery pack of its own.
        const prefix = pathKey(fullPath) + path.sep;
        if ([...seen].some((key) => key.startsWith(prefix))) continue;
        seen.add(pathKey(fullPath));
        pending.push({
          sceneryPath: `Custom Scenery/${dirEntry.name}`,
          fullPath,
          enabled: true,
        });
        continue;
      }

      // A Windows shortcut stands in for a scenery folder living elsewhere.
      // X-Plane does not follow .lnk files, so the INI gets the resolved target.
      if (!dirEntry.isFile() || !dirEntry.name.toLowerCase().endsWith('.lnk')) continue;

      const shortcutPath = path.join(this.customSceneryPath, dirEntry.name);
      const resolved = resolveLnkSync(shortcutPath);
      if (!resolved.ok) {
        logger.addon.warn(`scenery: unresolved shortcut ${dirEntry.name} (${resolved.reason})`);
        continue;
      }

      try {
        if (!(await fsp.stat(resolved.targetPath)).isDirectory()) {
          logger.addon.warn(
            `scenery: shortcut target is not a directory: ${dirEntry.name} -> ${resolved.targetPath}`
          );
          continue;
        }
      } catch {
        logger.addon.warn(
          `scenery: shortcut target missing: ${dirEntry.name} -> ${resolved.targetPath}`
        );
        continue;
      }

      const targetFull = path.resolve(resolved.targetPath);
      if (seen.has(pathKey(targetFull))) continue;
      seen.add(pathKey(targetFull));

      pending.push({
        sceneryPath: normalizeIniPath(resolved.targetPath),
        fullPath: targetFull,
        enabled: true,
        shortcutPath,
      });
    }
  }

  /**
   * Sort entries by priority, stable within same tier.
   */
  sort(entries: SceneryEntry[]): SceneryEntry[] {
    return [...entries].sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.originalIndex - b.originalIndex;
    });
  }

  /**
   * Save entries to INI file.
   * Backs up first and reuses the existing header so the file X-Plane reads
   * keeps its `SCENERY` line and line endings.
   * @param entries - Entries to save
   * @param preserveOrder - If true, don't auto-sort (for custom ordering)
   */
  async save(
    entries: SceneryEntry[],
    preserveOrder = true
  ): Promise<Result<{ backupPath: string }, SceneryError>> {
    const backupResult = backupSceneryPacksIni(this.iniPath, this.backupDir);
    if (!backupResult.ok) {
      return backupResult;
    }

    const existing = readIni(this.iniPath);
    const layout: Pick<ParsedIni, 'header' | 'eol'> = existing.ok
      ? { header: existing.value.header, eol: existing.value.eol }
      : { header: [], eol: '\n' };

    const toWrite = preserveOrder ? entries : this.sort(entries);

    const writeResult = writeSceneryPacksIni(this.iniPath, toWrite, layout);
    if (!writeResult.ok) {
      return writeResult;
    }

    return ok({ backupPath: backupResult.value });
  }

  /**
   * Toggle enabled/disabled for a single entry.
   */
  async toggle(sceneryPath: string): Promise<Result<SceneryEntry, SceneryError>> {
    const analyzeResult = await this.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    const entries = analyzeResult.value;
    const entry = entries.find((e) => e.sceneryPath === sceneryPath);

    if (!entry) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName: sceneryPath });
    }

    entry.enabled = !entry.enabled;

    const saveResult = await this.save(entries);
    if (!saveResult.ok) {
      return saveResult;
    }

    return ok(entry);
  }

  /**
   * Delete a scenery folder from disk and remove it from the INI.
   * A shortcut or symlink is unlinked and its target left alone; only a real
   * folder is removed recursively.
   */
  async deleteScenery(sceneryPath: string): Promise<Result<{ wasSymlink: boolean }, SceneryError>> {
    const analyzeResult = await this.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    const entries = analyzeResult.value;
    const entry = entries.find((e) => e.sceneryPath === sceneryPath);

    if (!entry || entry.isGlobalAirports) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName: sceneryPath });
    }

    const remaining = entries.filter((e) => e.sceneryPath !== sceneryPath);

    if (entry.missing) {
      const saveResult = await this.save(remaining);
      if (!saveResult.ok) return saveResult;
      return ok({ wasSymlink: false });
    }

    try {
      if (entry.shortcutPath) {
        fs.rmSync(entry.shortcutPath, { force: true });
        const saveResult = await this.save(remaining);
        if (!saveResult.ok) return saveResult;
        return ok({ wasSymlink: true });
      }

      const stat = fs.lstatSync(entry.fullPath);
      const wasSymlink = stat.isSymbolicLink();

      if (wasSymlink) {
        fs.unlinkSync(entry.fullPath);
      } else {
        fs.rmSync(entry.fullPath, { recursive: true, force: true });
      }

      const saveResult = await this.save(remaining);
      if (!saveResult.ok) return saveResult;

      return ok({ wasSymlink });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err({ code: 'WRITE_FAILED', path: entry.fullPath, reason: message });
    }
  }

  /**
   * Move entry up or down within its priority tier.
   */
  async move(
    sceneryPath: string,
    direction: 'up' | 'down'
  ): Promise<Result<SceneryEntry[], SceneryError>> {
    const analyzeResult = await this.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    const entries = analyzeResult.value;
    const index = entries.findIndex((e) => e.sceneryPath === sceneryPath);

    if (index === -1) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName: sceneryPath });
    }

    const entry = entries[index];
    if (!entry) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName: sceneryPath });
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= entries.length) {
      return ok(entries);
    }

    const targetEntry = entries[targetIndex];
    if (!targetEntry || targetEntry.priority !== entry.priority) {
      return ok(entries); // Can't move across tiers
    }

    entries[index] = targetEntry;
    entries[targetIndex] = entry;
    targetEntry.originalIndex = index;
    entry.originalIndex = targetIndex;

    const saveResult = await this.save(entries);
    if (!saveResult.ok) {
      return saveResult;
    }

    return ok(entries);
  }

  /**
   * Create manual backup.
   */
  async backup(): Promise<Result<string, SceneryError>> {
    return backupSceneryPacksIni(this.iniPath, this.backupDir);
  }

  /**
   * List available backups.
   */
  async listBackups(): Promise<{ path: string; timestamp: Date }[]> {
    if (!fs.existsSync(this.backupDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(this.backupDir);
      const backups: { path: string; timestamp: Date }[] = [];

      for (const f of files) {
        if (!f.startsWith('scenery_packs_') || !f.endsWith('.ini')) {
          continue;
        }
        try {
          const fullPath = path.join(this.backupDir, f);
          const stat = fs.statSync(fullPath);
          backups.push({ path: fullPath, timestamp: stat.mtime });
        } catch {
          // Skip files we can't stat
        }
      }

      return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch {
      return [];
    }
  }

  /**
   * Restore from backup.
   * Only allows restoring files from the backup directory.
   */
  async restore(backupPath: string): Promise<Result<void, SceneryError>> {
    const normalizedBackupPath = path.resolve(backupPath);
    const normalizedBackupDir = path.resolve(this.backupDir);

    if (!normalizedBackupPath.startsWith(normalizedBackupDir + path.sep)) {
      return err({ code: 'WRITE_FAILED', path: backupPath, reason: 'Invalid backup path' });
    }

    if (!fs.existsSync(backupPath)) {
      return err({ code: 'INI_NOT_FOUND', path: backupPath });
    }

    try {
      fs.copyFileSync(backupPath, this.iniPath);
      return ok(undefined);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return err({ code: 'WRITE_FAILED', path: this.iniPath, reason: message });
    }
  }
}
