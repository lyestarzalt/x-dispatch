// src/lib/addonManager/scenery/SceneryManager.ts
import * as fs from 'fs';
import * as path from 'path';
import {
  type ParsedIniEntry,
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
import { backupSceneryPacksIni, parseSceneryPacksIni, writeSceneryPacksIni } from './iniParser';

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
    // Parse INI
    const parseResult = parseSceneryPacksIni(this.iniPath, this.customSceneryPath);
    if (!parseResult.ok) {
      return parseResult;
    }

    // Process all INI entries including *GLOBAL_AIRPORTS*
    const entries: SceneryEntry[] = [];
    const staleNames = new Set<string>();

    for (let i = 0; i < parseResult.value.length; i++) {
      const iniEntry = parseResult.value[i];
      if (!iniEntry) continue;

      // Include *GLOBAL_AIRPORTS* as a special entry
      if (iniEntry.isGlobalAirports) {
        entries.push({
          folderName: '*GLOBAL_AIRPORTS*',
          fullPath: '',
          enabled: iniEntry.enabled,
          priority: SceneryPriority.DefaultAirport,
          classification: createDefaultClassification(),
          originalIndex: i,
          isGlobalAirports: true,
        });
        continue;
      }

      if (!fs.existsSync(iniEntry.fullPath)) {
        // Only mark relative (Custom Scenery/) entries as stale.
        // Absolute paths (external drives) may just be unmounted — never auto-remove them.
        if (!iniEntry.sceneryPath) {
          staleNames.add(iniEntry.folderName);
        }
        continue;
      }
      const entry = this.processEntry(iniEntry, i);
      entries.push(entry);
    }

    // Detect folders in Custom Scenery/ that aren't in the INI yet
    // (shown in UI but NOT written to INI — only explicit user saves modify the file)
    const knownFolders = new Set(parseResult.value.map((e) => e.folderName));
    staleNames.forEach((name) => knownFolders.add(name)); // don't re-add removed ones

    try {
      if (fs.existsSync(this.customSceneryPath)) {
        const dirEntries = fs.readdirSync(this.customSceneryPath, { withFileTypes: true });
        for (const dirEntry of dirEntries) {
          if (!dirEntry.isDirectory() && !dirEntry.isSymbolicLink()) continue;
          if (knownFolders.has(dirEntry.name)) continue;
          // Skip hidden folders and common non-scenery dirs
          if (dirEntry.name.startsWith('.') || dirEntry.name === '__MACOSX') continue;

          const fullPath = path.join(this.customSceneryPath, dirEntry.name);
          const iniEntry: ParsedIniEntry = {
            folderName: dirEntry.name,
            fullPath,
            enabled: true,
            isGlobalAirports: false,
            originalLine: '',
          };
          const entry = this.processEntry(iniEntry, entries.length);
          entries.push(entry);
        }
      }
    } catch {
      // Non-critical — new folders will be picked up by X-Plane on next launch
    }

    // Return in INI file order (analyze is read-only — never writes to the INI)
    return ok(entries);
  }

  /**
   * Process a single INI entry: scan folder, classify.
   * Note: DefaultAirport tier is ONLY for *GLOBAL_AIRPORTS* marker, not real folders.
   */
  private processEntry(iniEntry: ParsedIniEntry, index: number): SceneryEntry {
    const classification = scanSceneryFolder(iniEntry.fullPath);
    const priority = classifyScenery(iniEntry.folderName, classification);

    return {
      folderName: iniEntry.folderName,
      fullPath: iniEntry.fullPath,
      enabled: iniEntry.enabled,
      priority,
      classification,
      originalIndex: index,
      sceneryPath: iniEntry.sceneryPath,
    };
  }

  /**
   * Sort entries by priority, stable within same tier.
   */
  sort(entries: SceneryEntry[]): SceneryEntry[] {
    return [...entries].sort((a, b) => {
      // Primary: by priority (lower = higher in file)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Secondary: preserve original order within same tier
      return a.originalIndex - b.originalIndex;
    });
  }

  /**
   * Save entries to INI file.
   * Creates backup first.
   * @param entries - Entries to save
   * @param preserveOrder - If true, don't auto-sort (for custom ordering)
   */
  async save(
    entries: SceneryEntry[],
    preserveOrder = true
  ): Promise<Result<{ backupPath: string }, SceneryError>> {
    // Create backup first
    const backupResult = backupSceneryPacksIni(this.iniPath, this.backupDir);
    if (!backupResult.ok) {
      return backupResult;
    }

    // Sort entries unless preserveOrder is true
    const toWrite = preserveOrder ? entries : this.sort(entries);

    const writeResult = writeSceneryPacksIni(this.iniPath, toWrite);
    if (!writeResult.ok) {
      return writeResult;
    }

    return ok({ backupPath: backupResult.value });
  }

  /**
   * Toggle enabled/disabled for a single entry.
   */
  async toggle(folderName: string): Promise<Result<SceneryEntry, SceneryError>> {
    const analyzeResult = await this.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    const entries = analyzeResult.value;
    const entry = entries.find((e) => e.folderName === folderName);

    if (!entry) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName });
    }

    // Toggle
    entry.enabled = !entry.enabled;

    // Save
    const saveResult = await this.save(entries);
    if (!saveResult.ok) {
      return saveResult;
    }

    return ok(entry);
  }

  /**
   * Delete a scenery folder from disk and remove from INI.
   * Symlinks are unlinked (target untouched), real folders are removed recursively.
   * Returns whether the path was a symlink.
   */
  async deleteScenery(folderName: string): Promise<Result<{ wasSymlink: boolean }, SceneryError>> {
    const analyzeResult = await this.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    const entries = analyzeResult.value;
    const entry = entries.find((e) => e.folderName === folderName);

    if (!entry || entry.isGlobalAirports) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName });
    }

    try {
      const stat = fs.lstatSync(entry.fullPath);
      const wasSymlink = stat.isSymbolicLink();

      if (wasSymlink) {
        fs.unlinkSync(entry.fullPath);
      } else {
        fs.rmSync(entry.fullPath, { recursive: true, force: true });
      }

      // Remove deleted entry from INI
      const remaining = entries.filter((e) => e.folderName !== folderName);
      await this.save(remaining);

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
    folderName: string,
    direction: 'up' | 'down'
  ): Promise<Result<SceneryEntry[], SceneryError>> {
    const analyzeResult = await this.analyze();
    if (!analyzeResult.ok) {
      return analyzeResult;
    }

    const entries = analyzeResult.value;
    const index = entries.findIndex((e) => e.folderName === folderName);

    if (index === -1) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName });
    }

    const entry = entries[index];
    if (!entry) {
      return err({ code: 'FOLDER_NOT_FOUND', folderName });
    }

    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    // Check bounds and same priority tier
    if (targetIndex < 0 || targetIndex >= entries.length) {
      return ok(entries); // No change
    }

    const targetEntry = entries[targetIndex];
    if (!targetEntry || targetEntry.priority !== entry.priority) {
      return ok(entries); // Can't move across tiers
    }

    // Swap
    entries[index] = targetEntry;
    entries[targetIndex] = entry;

    // Update original indices to reflect new order
    targetEntry.originalIndex = index;
    entry.originalIndex = targetIndex;

    // Save
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
    // Security: Ensure backupPath is within our backup directory
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
