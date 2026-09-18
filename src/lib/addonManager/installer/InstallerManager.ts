import * as crypto from 'crypto';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
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
import { InstallTransaction, type StagedComponent } from './transaction';
import type {
  DetectedItem,
  InstallProgress,
  InstallResult,
  InstallTask,
  InstallerError,
  VerificationStats,
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
   * Install a single task.
   *
   * Every component is extracted and verified before anything is written into
   * X-Plane. The move itself runs inside a transaction, so a failure halfway
   * through leaves the folder exactly as it was.
   */
  private async installTask(
    task: InstallTask,
    onProgress: (bytes: number, file: string) => void
  ): Promise<InstallResult> {
    const components =
      task.components.length > 0
        ? task.components
        : [{ internalRoot: task.archiveInternalRoot, targetPath: task.targetPath }];

    const backupRoot = path.join(this.xplanePath, 'Output', 'xdispatch_backups');
    const transaction = new InstallTransaction(backupRoot, task.displayName);
    const staged: StagedComponent[] = [];
    const totals: VerificationStats = {
      totalFiles: 0,
      verifiedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
    };

    const discardStaging = async () => {
      for (const component of staged) {
        await fsp.rm(component.tempDir, { recursive: true, force: true }).catch(() => undefined);
      }
    };

    const failure = async (error: string): Promise<InstallResult> => {
      await discardStaging();
      return { taskId: task.id, success: false, error, verificationStats: totals };
    };

    try {
      for (let i = 0; i < components.length; i++) {
        const component = components[i];
        if (!component) continue;

        const tempDir = path.join(os.tmpdir(), `xdispatch_install_${crypto.randomUUID()}`);
        await fsp.mkdir(tempDir, { recursive: true });
        staged.push({
          tempDir,
          targetPath: component.targetPath,
          clean: i === 0 && task.installMode === 'clean' && task.conflictExists,
        });

        const extractResult = await extractArchive({
          archivePath: task.sourcePath,
          targetDir: tempDir,
          internalRoot: component.internalRoot,
          onProgress,
        });

        if (!extractResult.ok) {
          logger.addon.error(
            `Extraction failed for ${task.displayName}: ${extractResult.error.code}`
          );
          return failure(`Extraction failed: ${extractResult.error.code}`);
        }

        // A partial extraction must never reach the target, or a half-written
        // addon silently replaces a working one.
        const stats = extractResult.value.stats;
        totals.totalFiles += stats.totalFiles;
        totals.verifiedFiles += stats.verifiedFiles;
        totals.failedFiles += stats.failedFiles;
        totals.skippedFiles += stats.skippedFiles;

        if (stats.failedFiles > 0) {
          return failure(
            `Extraction incomplete: ${stats.failedFiles} of ${stats.totalFiles} files failed`
          );
        }
        if (stats.totalFiles === 0) {
          return failure('Archive contained no installable files');
        }
      }

      await transaction.apply(staged);
    } catch (e) {
      logger.addon.error(`Install failed for ${task.displayName}, rolling back: ${e}`);
      await transaction.rollback();
      await discardStaging();
      return { taskId: task.id, success: false, error: String(e) };
    }

    // The addon is in place. A failure past this point is worth reporting but
    // not worth undoing a good install for.
    try {
      await this.postInstall(task);
    } catch (e) {
      logger.addon.error(`Post-install step failed for ${task.displayName}: ${e}`);
    }

    await discardStaging();
    await InstallTransaction.pruneBackups(backupRoot);

    const backupPath = transaction.getBackupPath();

    return {
      taskId: task.id,
      success: true,
      verificationStats: totals,
      ...(backupPath ? { backupPath } : {}),
    };
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
