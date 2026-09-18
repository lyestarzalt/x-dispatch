// src/lib/addonManager/scenery/SceneryManager.ts
import * as fs from 'fs';
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
   */
  async analyze(): Promise<Result<SceneryEntry[], SceneryError>> {
    const iniResult = readIni(this.iniPath);
    if (!iniResult.ok) {
      return iniResult;
    }

    const entries: SceneryEntry[] = [];
    const seen = new Set<string>();

    for (const iniEntry of iniResult.value.entries) {
      if (iniEntry.isGlobalAirports) {
        if (seen.has(GLOBAL_AIRPORTS_MARKER)) continue;
        seen.add(GLOBAL_AIRPORTS_MARKER);
        entries.push({
          sceneryPath: GLOBAL_AIRPORTS_MARKER,
          displayName: GLOBAL_AIRPORTS_MARKER,
          fullPath: '',
          enabled: iniEntry.enabled,
          priority: SceneryPriority.DefaultAirport,
          classification: createDefaultClassification(),
          originalIndex: entries.length,
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
        entries.push({
          sceneryPath: iniEntry.sceneryPath,
          displayName: path.basename(iniEntry.sceneryPath),
          fullPath: iniEntry.fullPath,
          enabled: iniEntry.enabled,
          priority: SceneryPriority.Unrecognized,
          classification: createDefaultClassification(),
          originalIndex: entries.length,
          missing: true,
        });
        continue;
      }

      entries.push(
        this.buildEntry(
          {
            sceneryPath: iniEntry.sceneryPath,
            fullPath: iniEntry.fullPath,
            enabled: iniEntry.enabled,
            index: entries.length,
          },
          seen
        )
      );
    }

    this.appendUnlistedFolders(entries, seen);

    return ok(entries);
  }

  /**
   * Add Custom Scenery folders the INI does not list yet.
   * They are shown in the UI; nothing is written until the user saves.
   */
  private appendUnlistedFolders(entries: SceneryEntry[], seen: Set<string>): void {
    let dirEntries: fs.Dirent[];
    try {
      if (!fs.existsSync(this.customSceneryPath)) return;
      dirEntries = fs.readdirSync(this.customSceneryPath, { withFileTypes: true });
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
        entries.push(
          this.buildEntry({
            sceneryPath: `Custom Scenery/${dirEntry.name}`,
            fullPath,
            enabled: true,
            index: entries.length,
          })
        );
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
        if (!fs.statSync(resolved.targetPath).isDirectory()) {
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

      entries.push(
        this.buildEntry({
          sceneryPath: normalizeIniPath(resolved.targetPath),
          fullPath: targetFull,
          enabled: true,
          index: entries.length,
          shortcutPath,
        })
      );
    }
  }

  /**
   * Scan and classify one folder.
   * DefaultAirport tier is ONLY for the *GLOBAL_AIRPORTS* marker, not real folders.
   */
  private buildEntry(
    input: {
      sceneryPath: string;
      fullPath: string;
      enabled: boolean;
      index: number;
      shortcutPath?: string;
    },
    seen?: Set<string>
  ): SceneryEntry {
    // An INI entry may point straight at a .lnk file. Classify its target, but
    // keep the path the INI uses so the round trip stays byte-identical.
    let scanPath = input.fullPath;
    let shortcutPath = input.shortcutPath;
    try {
      if (input.fullPath.toLowerCase().endsWith('.lnk') && fs.statSync(input.fullPath).isFile()) {
        const resolved = resolveLnkSync(input.fullPath);
        if (resolved.ok && fs.existsSync(resolved.targetPath)) {
          scanPath = resolved.targetPath;
          shortcutPath = input.fullPath;
          // Claim the target too, so the directory walk does not list the same
          // scenery a second time under its resolved path.
          seen?.add(pathKey(path.resolve(scanPath)));
        }
      }
    } catch {
      // Fall through with the original path; classification comes back empty.
    }

    const displayName = path.basename(input.sceneryPath);
    const classification = scanSceneryFolder(scanPath);

    return {
      sceneryPath: input.sceneryPath,
      displayName,
      fullPath: input.fullPath,
      enabled: input.enabled,
      priority: classifyScenery(displayName, classification),
      classification,
      originalIndex: input.index,
      ...(shortcutPath ? { shortcutPath } : {}),
    };
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
