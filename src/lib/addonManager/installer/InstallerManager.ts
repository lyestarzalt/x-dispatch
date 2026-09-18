import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import { SceneryManager } from '../scenery/SceneryManager';
import {
  checkCompressionRatio,
  detectArchiveFormat,
  listArchiveEntries,
} from './detection/ArchiveScanner';
import { detectAddons } from './detection/TypeDetector';
import { extractArchive } from './extraction';
import {
  createInstallTask,
  isFlyWithLuaInstalled,
  isLiveryAircraftInstalled,
} from './targetResolver';
import type {
  DetectedItem,
  InstallProgress,
  InstallResult,
  InstallTask,
  InstallerError,
} from './types';
import { INSTALLER_CONSTANTS } from './types';

export interface InstallOptions {
  /** Progress callback */
  onProgress?: (progress: InstallProgress) => void;
}

export class InstallerManager {
  private readonly xplanePath: string;

  constructor(xplanePath: string) {
    this.xplanePath = xplanePath;
  }

  /**
   * Get X-Plane path
   */
  getXPlanePath(): string {
    return this.xplanePath;
  }

  /**
   * Analyze dropped files and detect addons
   */
  async analyze(filePaths: string[]): Promise<Result<DetectedItem[], InstallerError>> {
    const allItems: DetectedItem[] = [];

    for (const filePath of filePaths) {
      const format = detectArchiveFormat(filePath);
      if (!format) {
        // Skip non-archive files (could be folders - handle later)
        continue;
      }

      const entriesResult = await listArchiveEntries(filePath);
      if (!entriesResult.ok) {
        return entriesResult;
      }

      const entries = entriesResult.value;

      // Check for zip bomb
      const totalCompressed = entries.reduce((sum, e) => sum + e.compressedSize, 0);
      const totalUncompressed = entries.reduce((sum, e) => sum + e.uncompressedSize, 0);

      const { suspicious, ratio } = checkCompressionRatio(
        totalCompressed,
        totalUncompressed,
        INSTALLER_CONSTANTS.MAX_COMPRESSION_RATIO
      );

      if (suspicious) {
        logger.security.warn(`Suspicious compression ratio ${ratio.toFixed(0)}x in: ${filePath}`);
        return err({
          code: 'SUSPICIOUS_RATIO',
          ratio,
          limit: INSTALLER_CONSTANTS.MAX_COMPRESSION_RATIO,
        });
      }

      if (totalUncompressed > INSTALLER_CONSTANTS.MAX_EXTRACTION_SIZE) {
        return err({
          code: 'SIZE_EXCEEDED',
          size: totalUncompressed,
          limit: INSTALLER_CONSTANTS.MAX_EXTRACTION_SIZE,
        });
      }

      // Detect addons in this archive
      const detected = detectAddons(filePath, format, entries);

      // Add size warnings
      for (const item of detected) {
        if (item.estimatedSize > 5 * 1024 * 1024 * 1024) {
          // > 5GB
          item.warnings.push(
            `Large addon: ${(item.estimatedSize / (1024 * 1024 * 1024)).toFixed(1)} GB`
          );
        }
      }

      allItems.push(...detected);
    }

    return ok(allItems);
  }

  /**
   * Prepare install tasks from detected items
   */
  prepareInstallTasks(items: DetectedItem[]): InstallTask[] {
    return items.map((item) => {
      const task = createInstallTask(item, this.xplanePath);

      // Add warnings for special cases
      if (item.addonType === 'LuaScript' && !isFlyWithLuaInstalled(this.xplanePath)) {
        task.warnings.push('FlyWithLua plugin not installed - script may not work');
      }

      if (item.addonType === 'Livery' && !isLiveryAircraftInstalled(item, this.xplanePath)) {
        task.warnings.push('Target aircraft not found - livery may not appear');
      }

      return task;
    });
  }

  /**
   * Install addons from prepared tasks
   */
  async install(
    tasks: InstallTask[],
    options?: InstallOptions
  ): Promise<Result<InstallResult[], InstallerError>> {
    const results: InstallResult[] = [];
    const totalBytes = tasks.reduce((sum, t) => sum + t.estimatedSize, 0);
    let processedBytes = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task) continue;
      const taskStartBytes = processedBytes;

      // Report progress
      options?.onProgress?.({
        phase: 'extracting',
        overallPercent: Math.round((processedBytes / totalBytes) * 100),
        currentTaskIndex: i,
        totalTasks: tasks.length,
        currentTaskName: task.displayName,
        bytesProcessed: processedBytes,
        bytesTotal: totalBytes,
      });

      const result = await this.installTask(task, (bytes, file) => {
        processedBytes = taskStartBytes + bytes;
        options?.onProgress?.({
          phase: 'extracting',
          overallPercent: Math.round((processedBytes / totalBytes) * 100),
          currentTaskIndex: i,
          totalTasks: tasks.length,
          currentTaskName: task.displayName,
          currentFile: file,
          bytesProcessed: processedBytes,
          bytesTotal: totalBytes,
        });
      });

      results.push(result);

      // Ensure we count the full task size even if extraction reported less
      processedBytes = taskStartBytes + task.estimatedSize;
    }

    // Final progress
    options?.onProgress?.({
      phase: 'finalizing',
      overallPercent: 100,
      currentTaskIndex: tasks.length,
      totalTasks: tasks.length,
      currentTaskName: 'Complete',
      bytesProcessed: totalBytes,
      bytesTotal: totalBytes,
    });

    return ok(results);
  }

  /**
   * Install a single task
   */
  private async installTask(
    task: InstallTask,
    onProgress: (bytes: number, file: string) => void
  ): Promise<InstallResult> {
    const tempDir = path.join(os.tmpdir(), `xdispatch_install_${crypto.randomUUID()}`);

    try {
      // Create temp directory
      fs.mkdirSync(tempDir, { recursive: true });

      // Extract to temp directory
      const extractResult = await extractArchive({
        archivePath: task.sourcePath,
        targetDir: tempDir,
        internalRoot: task.archiveInternalRoot,
        onProgress,
      });

      if (!extractResult.ok) {
        logger.addon.error(
          `Extraction failed for ${task.displayName}: ${extractResult.error.code}`
        );
        return {
          taskId: task.id,
          success: false,
          error: `Extraction failed: ${extractResult.error.code}`,
        };
      }

      // A partial extraction must never reach the target, or a half-written
      // addon silently replaces a working one.
      const stats = extractResult.value.stats;
      if (stats.failedFiles > 0) {
        return {
          taskId: task.id,
          success: false,
          error: `Extraction incomplete: ${stats.failedFiles} of ${stats.totalFiles} files failed`,
          verificationStats: stats,
        };
      }
      if (stats.totalFiles === 0) {
        return {
          taskId: task.id,
          success: false,
          error: 'Archive contained no installable files',
          verificationStats: stats,
        };
      }

      // Handle installation mode
      if (task.installMode === 'clean' && task.conflictExists) {
        // Backup if needed
        await this.backupBeforeClean(task);
        // Remove existing
        fs.rmSync(task.targetPath, { recursive: true, force: true });
      }

      // Move/merge to target
      fs.mkdirSync(path.dirname(task.targetPath), { recursive: true });

      if (task.installMode === 'overwrite' && task.conflictExists) {
        // Merge files
        this.copyMerge(tempDir, task.targetPath);
      } else {
        // Fresh install or clean install - just rename
        if (fs.existsSync(task.targetPath)) {
          // Merge if target exists (shouldn't happen for clean, but be safe)
          this.copyMerge(tempDir, task.targetPath);
        } else {
          try {
            fs.renameSync(tempDir, task.targetPath);
          } catch (err: unknown) {
            // EXDEV: rename fails across different drives (e.g., temp on C:, X-Plane on D:)
            if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
              fs.cpSync(tempDir, task.targetPath, { recursive: true });
              fs.rmSync(tempDir, { recursive: true, force: true });
            } else {
              throw err;
            }
          }
        }
      }

      // Post-install actions
      await this.postInstall(task);

      // Cleanup temp if it still exists
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      return {
        taskId: task.id,
        success: true,
        verificationStats: stats,
      };
    } catch (e) {
      logger.addon.error(`Install failed for ${task.displayName}: ${e}`);
      // Cleanup temp on failure
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }

      return {
        taskId: task.id,
        success: false,
        error: String(e),
      };
    }
  }

  /**
   * Backup items before clean install
   */
  private async backupBeforeClean(task: InstallTask): Promise<void> {
    if (!task.conflictExists) return;

    const backupDir = `${task.targetPath}.backup_${Date.now()}`;

    if (task.backupOptions.liveries) {
      const liveriesDir = path.join(task.targetPath, 'liveries');
      if (fs.existsSync(liveriesDir)) {
        const backupLiveries = path.join(backupDir, 'liveries');
        fs.mkdirSync(backupLiveries, { recursive: true });
        fs.cpSync(liveriesDir, backupLiveries, { recursive: true });
      }
    }

    if (task.backupOptions.configFiles && task.backupOptions.configPatterns.length > 0) {
      for (const pattern of task.backupOptions.configPatterns) {
        // Simple glob matching for common patterns
        const files = this.findMatchingFiles(task.targetPath, pattern);
        for (const file of files) {
          const relativePath = path.relative(task.targetPath, file);
          const backupPath = path.join(backupDir, relativePath);
          fs.mkdirSync(path.dirname(backupPath), { recursive: true });
          fs.copyFileSync(file, backupPath);
        }
      }
    }

    // Store backup location for potential restore
    if (fs.existsSync(backupDir)) {
      // After install, we'd restore from here
      // For now, just leave the backup
    }
  }

  /**
   * Find files matching a simple glob pattern
   */
  private findMatchingFiles(dir: string, pattern: string): string[] {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');

    const walk = (currentDir: string) => {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (regex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    };

    walk(dir);
    return results;
  }

  /**
   * Copy source into dest, merging directories
   */
  private copyMerge(src: string, dst: string): void {
    if (!fs.existsSync(src)) return;

    fs.mkdirSync(dst, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);

      if (entry.isDirectory()) {
        this.copyMerge(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
      }
    }
  }

  /**
   * Post-installation actions
   */
  private async postInstall(task: InstallTask): Promise<void> {
    if (task.addonType === 'Scenery' || task.addonType === 'SceneryLibrary') {
      await this.addToSceneryPacks(task.targetPath);
    }
  }

  /**
   * Register a freshly installed pack in scenery_packs.ini.
   *
   * The pack goes at the end of its own priority tier, so an airport lands
   * above the meshes and an ortho tile below them. Everything else keeps its
   * order, and the INI is backed up before it is rewritten.
   */
  private async addToSceneryPacks(targetPath: string): Promise<void> {
    const iniPath = path.join(this.xplanePath, 'Custom Scenery', 'scenery_packs.ini');
    if (!fs.existsSync(iniPath)) {
      fs.mkdirSync(path.dirname(iniPath), { recursive: true });
      fs.writeFileSync(iniPath, ['I', '1000 Version', 'SCENERY', '', ''].join('\n'), 'utf-8');
    }

    const manager = new SceneryManager(this.xplanePath);
    const analyzed = await manager.analyze();
    if (!analyzed.ok) {
      logger.addon.error(`scenery_packs.ini not updated: ${analyzed.error.code}`);
      return;
    }

    const entries = analyzed.value;
    const resolved = path.resolve(targetPath);
    const index = entries.findIndex((e) => path.resolve(e.fullPath) === resolved);
    if (index === -1) return;

    const [entry] = entries.splice(index, 1);
    if (!entry) return;

    const before = entries.findIndex((e) => e.priority > entry.priority);
    entries.splice(before === -1 ? entries.length : before, 0, entry);
    entries.forEach((e, i) => {
      e.originalIndex = i;
    });

    const saved = await manager.save(entries, true);
    if (!saved.ok) {
      logger.addon.error(`scenery_packs.ini not updated: ${saved.error.code}`);
    }
  }
}
