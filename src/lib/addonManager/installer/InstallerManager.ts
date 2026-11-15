import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import { parseLibraryExportLines } from '../scenery/libraryTxt';
import type { LibraryIndex } from '../scenery/missingLibraries';
import { buildLibraryIndex, missingLibrariesFor } from '../scenery/missingLibraries';
import { checkCompressionRatio, listArchiveEntries } from './detection/ArchiveScanner';
import { detectAddons } from './detection/TypeDetector';
import type { ArchiveSource } from './detection/archiveFormat';
import { isArchiveFileName, prepareArchiveSource } from './detection/archiveFormat';
import type { SceneryVariant } from './detection/sceneryVariants';
import {
  VERSION_FILES,
  VERSION_FILE_MAX_BYTES,
  parseCycleJson,
  parseVersionFile,
} from './detection/versionInfo';
import { extractArchive, probeArchiveEntry, readArchiveEntry } from './extraction';
import { assertSameTree, mergeInto, moveIntoPlace } from './move';
import {
  createInstallTask,
  isFlyWithLuaInstalled,
  isLiveryAircraftInstalled,
} from './targetResolver';
import type {
  ArchiveEntry,
  DetectedItem,
  InstallProgress,
  InstallResult,
  InstallTask,
  InstallerError,
  NestedArchiveStep,
  VerificationStats,
} from './types';
import { INSTALLER_CONSTANTS, getInstallerErrorMessage } from './types';
import { expectedFiles, verifyMarkers, verifyPlacement, withVariant } from './verify';

export interface InstallOptions {
  /** Progress callback */
  onProgress?: (progress: InstallProgress) => void;
}

/** Passwords the user typed, keyed by the dropped path. Lives only for the request. */
export type ArchivePasswords = Record<string, string>;

/** Navdata providers whose folder under Custom Data we know. */
const KNOWN_NAVDATA_PROVIDERS = /X-Plane|GNS430|FlightFactor|UFMC/i;

function tempPath(prefix: string): string {
  return path.join(os.tmpdir(), `xdispatch_${prefix}_${crypto.randomUUID()}`);
}

/** The archive to read for a task, after opening every enclosing archive. */
interface OpenedSource extends ArchiveSource {
  cleanup: () => Promise<void>;
}

/** An option folder's path inside the pack folder, or null when it sits outside it. */
function variantRelativeDir(root: string, internalRoot: string | undefined): string | null {
  const prefix = internalRoot ?? '';
  if (!root.startsWith(prefix)) return null;
  return root.slice(prefix.length).replace(/\/$/, '') || null;
}

/**
 * Lay a variant's files over the installed pack: extract just those entries to a
 * scratch folder, then copy each to where the base file was.
 */
async function applyVariant(
  source: OpenedSource,
  task: InstallTask,
  variant: SceneryVariant,
  files: SceneryVariant['files']
): Promise<void> {
  if (files.length === 0) return;
  const scratch = tempPath('variant');
  try {
    const extracted = await extractArchive(source.format, {
      archivePath: source.readPath,
      volumes: source.volumes,
      targetDir: scratch,
      password: task.password,
      only: files.map((file) => file.source),
    });
    if (!extracted.ok) {
      throw Object.assign(new Error(getInstallerErrorMessage(extracted.error)), {
        code: extracted.error.code,
      });
    }
    for (const file of files) {
      const from = path.join(scratch, ...file.source.split('/'));
      const to = path.join(task.targetPath, ...file.destination.split('/'));
      await fs.promises.mkdir(path.dirname(to), { recursive: true });
      await fs.promises.copyFile(from, to);
    }
    logger.addon.info(
      `Applied variant ${variant.name} to ${task.displayName}: ${files.length} file(s)`
    );
  } finally {
    await fs.promises.rm(scratch, { recursive: true, force: true }).catch(() => {});
  }
}

/** Tiles read per scenery item, and the largest one worth extracting for its header. */
const LIBRARY_CHECK_MAX_DSFS = 3;
const LIBRARY_CHECK_MAX_DSF_BYTES = 64 * 1024 * 1024;

export class InstallerManager {
  private readonly xplanePath: string;
  private libraryIndex: Promise<LibraryIndex> | null = null;

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
   * Analyze dropped files or folders and detect addons
   */
  async analyze(
    filePaths: string[],
    passwords: ArchivePasswords = {}
  ): Promise<Result<DetectedItem[], InstallerError>> {
    const allItems: DetectedItem[] = [];

    for (const filePath of filePaths) {
      const prepared = await prepareArchiveSource(filePath);
      if (!prepared.ok) return prepared;

      try {
        const items = await this.analyzeSource(
          filePath,
          prepared.value,
          passwords[filePath],
          0,
          []
        );
        if (!items.ok) return items;
        for (const item of items.value) item.sourceFormat = prepared.value.format;
        allItems.push(...items.value);
      } finally {
        await prepared.value.cleanup();
      }
    }

    return ok(allItems);
  }

  /**
   * Detect add-ons in one source: the dropped file or folder, or an archive found
   * inside it. `chain` is how to reach this source from the dropped file.
   */
  private async analyzeSource(
    originalPath: string,
    source: ArchiveSource,
    password: string | undefined,
    depth: number,
    chain: NestedArchiveStep[]
  ): Promise<Result<DetectedItem[], InstallerError>> {
    const entriesResult = await listArchiveEntries(source, password);
    if (!entriesResult.ok) return this.withOriginalPath(entriesResult, originalPath);
    const entries = entriesResult.value;

    if (source.format !== 'folder') {
      const guard = this.guardArchiveSize(entries, originalPath);
      if (guard) return guard;
    }

    const encrypted = entries
      .filter((e) => e.encrypted && !e.isDirectory)
      .sort((a, b) => a.uncompressedSize - b.uncompressedSize)[0];
    if (encrypted) {
      if (!password) return err({ code: 'PASSWORD_REQUIRED', path: originalPath });
      // Opening the smallest entry proves the password before the user is shown an add-on
      const probe = await probeArchiveEntry(source, encrypted.path, password);
      if (!probe.ok) {
        const code =
          probe.error.code === 'PASSWORD_REQUIRED' ? 'INVALID_PASSWORD' : probe.error.code;
        return this.withOriginalPath(err({ ...probe.error, code } as InstallerError), originalPath);
      }
    }

    const detected = detectAddons(originalPath, source.format, entries);
    for (const item of detected) {
      if (chain.length) item.extractionChain = chain;
      if (password) item.password = password;
      if (item.estimatedSize > INSTALLER_CONSTANTS.LARGE_ADDON_BYTES) {
        item.warnings.push({
          code: 'LARGE_ADDON',
          params: { gb: (item.estimatedSize / (1024 * 1024 * 1024)).toFixed(1) },
        });
      }
      await this.enrichItem(item, source, entries, password);
    }

    if (detected.length > 0 || depth >= INSTALLER_CONSTANTS.NESTED_ARCHIVE_MAX_DEPTH) {
      return ok(detected);
    }

    // Nothing here: the add-on may sit in an archive inside this one
    return this.analyzeNested(originalPath, source, entries, password, depth, chain);
  }

  /** Zip bombs and absurd sizes are refused before anything is extracted. */
  private guardArchiveSize(
    entries: ArchiveEntry[],
    originalPath: string
  ): Result<never, InstallerError> | null {
    const totalCompressed = entries.reduce((sum, e) => sum + e.compressedSize, 0);
    const totalUncompressed = entries.reduce((sum, e) => sum + e.uncompressedSize, 0);

    const { suspicious, ratio } = checkCompressionRatio(
      totalCompressed,
      totalUncompressed,
      INSTALLER_CONSTANTS.MAX_COMPRESSION_RATIO
    );
    if (suspicious) {
      logger.security.warn(`Suspicious compression ratio ${ratio.toFixed(0)}x in: ${originalPath}`);
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
    return null;
  }

  /** Errors name the dropped file, never a temporary path. */
  private withOriginalPath<T>(
    result: Result<T, InstallerError>,
    originalPath: string
  ): Result<T, InstallerError> {
    if (result.ok || !('path' in result.error)) return result;
    return err({ ...result.error, path: originalPath } as InstallerError);
  }

  /**
   * Look inside archives found in this source, a bounded number of them, two levels
   * at most. Each is extracted on its own to a temporary folder and scanned there.
   */
  private async analyzeNested(
    originalPath: string,
    source: ArchiveSource,
    entries: ArchiveEntry[],
    password: string | undefined,
    depth: number,
    chain: NestedArchiveStep[]
  ): Promise<Result<DetectedItem[], InstallerError>> {
    const nested = entries
      .filter((e) => !e.isDirectory && isArchiveFileName(e.path))
      .slice(0, INSTALLER_CONSTANTS.NESTED_ARCHIVE_MAX_COUNT);
    if (nested.length === 0) return ok([]);

    const found: DetectedItem[] = [];
    for (const entry of nested) {
      const tempDir = tempPath('nested');
      try {
        const extracted = await extractArchive(source.format, {
          archivePath: source.readPath,
          volumes: source.volumes,
          targetDir: tempDir,
          only: [entry.path],
          password,
        });
        if (!extracted.ok) {
          if (extracted.error.code === 'INVALID_PASSWORD') {
            return this.withOriginalPath(extracted, originalPath);
          }
          logger.addon.warn(`Nested archive ${entry.path} skipped: ${extracted.error.code}`);
          continue;
        }
        const written = extracted.value.extractedFiles[0];
        if (!written) continue;

        const inner = await prepareArchiveSource(path.join(tempDir, written));
        if (!inner.ok) continue;
        try {
          const items = await this.analyzeSource(originalPath, inner.value, password, depth + 1, [
            ...chain,
            { entryPath: entry.path },
          ]);
          if (!items.ok) {
            if (
              items.error.code === 'PASSWORD_REQUIRED' ||
              items.error.code === 'INVALID_PASSWORD'
            ) {
              return items;
            }
            continue;
          }
          for (const item of items.value) {
            item.warnings.push({
              code: 'NESTED_ARCHIVE',
              params: { name: path.basename(entry.path) },
            });
          }
          found.push(...items.value);
        } finally {
          await inner.value.cleanup();
        }
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      }
    }
    return ok(found);
  }

  /** Read the small files that say what an add-on is: cycle.json, version files. */
  private async enrichItem(
    item: DetectedItem,
    source: ArchiveSource,
    entries: ArchiveEntry[],
    password: string | undefined
  ): Promise<void> {
    if (item.addonType === 'Navdata' && item.markerPath) {
      await this.readNavdataInfo(item, source, password);
    }
    if (item.addonType === 'Aircraft' || item.addonType === 'Plugin') {
      await this.readVersionInfo(item, source, entries, password);
    }
    if (item.addonType === 'Scenery') {
      await this.checkLibraries(item, source, entries, password);
    }
  }

  /**
   * Read a few of the package's tiles and say which libraries they need that
   * are not installed, so the user learns it here and not from empty aprons.
   */
  private async checkLibraries(
    item: DetectedItem,
    source: ArchiveSource,
    entries: ArchiveEntry[],
    password: string | undefined
  ): Promise<void> {
    const root = item.archiveInternalRoot ?? '';
    const tiles = entries
      .filter((e) => !e.isDirectory && e.path.startsWith(root) && /\.dsf$/i.test(e.path))
      .filter((e) => e.uncompressedSize <= LIBRARY_CHECK_MAX_DSF_BYTES)
      .slice(0, LIBRARY_CHECK_MAX_DSFS);
    if (tiles.length === 0) return;

    const tempDir = tempPath('tiles');
    try {
      const extracted = await extractArchive(source.format, {
        archivePath: source.readPath,
        volumes: source.volumes,
        targetDir: tempDir,
        only: tiles.map((t) => t.path),
        password,
      });
      if (!extracted.ok) return;
      const dsfPaths = extracted.value.extractedFiles.map((f) => path.join(tempDir, f));

      const files = new Set(entries.map((e) => e.path.toLowerCase()));
      const ownLibrary = entries.find(
        (e) => e.path.toLowerCase() === `${root.toLowerCase()}library.txt`
      );
      let ownExports: string[] = [];
      if (ownLibrary) {
        const text = await readArchiveEntry(source, ownLibrary.path, password, 16 * 1024 * 1024);
        if (text.ok) ownExports = parseLibraryExportLines(text.value.toString('utf8'));
      }

      this.libraryIndex ??= buildLibraryIndex(this.xplanePath);
      const missing = await missingLibrariesFor({
        dsfPaths,
        hasOwnFile: (ref) => files.has(`${root}${ref}`.toLowerCase()),
        index: await this.libraryIndex,
        ownExports,
      });
      if (missing.length > 0) {
        item.warnings.push({
          code: 'MISSING_LIBRARIES',
          params: { libraries: missing.join(', '), count: missing.length },
        });
      }
    } catch (e) {
      logger.addon.debug(`Library check skipped for ${item.displayName}: ${String(e)}`);
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  private async readNavdataInfo(
    item: DetectedItem,
    source: ArchiveSource,
    password: string | undefined
  ): Promise<void> {
    if (!item.markerPath) return;
    const content = await readArchiveEntry(source, item.markerPath, password);
    if (!content.ok) return;
    const info = parseCycleJson(content.value.toString('utf8'));
    // not JSON: installed as plain navdata into Custom Data
    if (!info) return;
    item.navdataInfo = info;
    const name = info.name;
    if (name) item.displayName = name;
    if (/GNS430/i.test(name) && item.archiveInternalRoot) {
      // GNS430 data keeps its `navdata/` folder: install the folder above cycle.json's
      const parent = path.posix.dirname(item.archiveInternalRoot.replace(/\/$/, ''));
      item.archiveInternalRoot = parent === '.' ? undefined : `${parent}/`;
    }
    if (!KNOWN_NAVDATA_PROVIDERS.test(name)) {
      item.warnings.push({ code: 'UNKNOWN_NAVDATA_PROVIDER', params: { name } });
    }
  }

  private async readVersionInfo(
    item: DetectedItem,
    source: ArchiveSource,
    entries: ArchiveEntry[],
    password: string | undefined
  ): Promise<void> {
    const root = item.archiveInternalRoot ?? '';
    const candidates = entries
      .filter((e) => !e.isDirectory && e.path.startsWith(root))
      .filter((e) => e.uncompressedSize <= VERSION_FILE_MAX_BYTES)
      .map((e) => ({ entry: e, name: path.posix.basename(e.path).toLowerCase() }))
      .filter((c) => VERSION_FILES.includes(c.name))
      .sort((a, b) => {
        const depthA = a.entry.path.split('/').length;
        const depthB = b.entry.path.split('/').length;
        if (depthA !== depthB) return depthA - depthB;
        return VERSION_FILES.indexOf(a.name) - VERSION_FILES.indexOf(b.name);
      });
    const chosen = candidates[0];
    if (!chosen) return;

    const content = await readArchiveEntry(source, chosen.entry.path, password);
    if (!content.ok) return;
    const version = parseVersionFile(chosen.name, content.value.toString('utf8'));
    if (version) item.versionInfo = { version, source: chosen.name };
  }

  /**
   * Prepare install tasks from detected items
   */
  prepareInstallTasks(items: DetectedItem[]): InstallTask[] {
    return items.map((item) => {
      const task = createInstallTask(item, this.xplanePath);

      // Add warnings for special cases
      if (item.addonType === 'LuaScript' && !isFlyWithLuaInstalled(this.xplanePath)) {
        task.warnings.push({ code: 'FLYWITHLUA_MISSING' });
      }

      if (item.addonType === 'Livery' && !isLiveryAircraftInstalled(item, this.xplanePath)) {
        task.warnings.push({
          code: 'AIRCRAFT_NOT_FOUND',
          params: { aircraft: item.liveryInfo?.aircraftName ?? '' },
        });
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

      // Extractors report each file's own size; the running total is kept here,
      // capped at the estimate so a pack never reads as more than 100%
      let taskBytes = 0;
      let lastEmit = 0;
      const result = await this.installTask(task, (bytes, file) => {
        taskBytes = Math.min(taskBytes + bytes, task.estimatedSize);
        processedBytes = taskStartBytes + taskBytes;
        const now = Date.now();
        if (now - lastEmit < INSTALLER_CONSTANTS.PROGRESS_THROTTLE_MS) return;
        lastEmit = now;
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
   * Open the archive that holds a task's add-on: the dropped file itself, or the
   * innermost of a chain of archives, each extracted to a temporary folder.
   */
  private async openSource(task: InstallTask): Promise<Result<OpenedSource, InstallerError>> {
    const cleanups: Array<() => Promise<void>> = [];
    const cleanupAll = async () => {
      for (const cleanup of cleanups.reverse()) await cleanup().catch(() => {});
    };

    let prepared = await prepareArchiveSource(task.sourcePath);
    if (!prepared.ok) return prepared;
    cleanups.push(prepared.value.cleanup);

    for (const step of task.extractionChain ?? []) {
      const tempDir = tempPath('chain');
      cleanups.push(() => fs.promises.rm(tempDir, { recursive: true, force: true }));
      const extracted = await extractArchive(prepared.value.format, {
        archivePath: prepared.value.readPath,
        volumes: prepared.value.volumes,
        targetDir: tempDir,
        only: [step.entryPath],
        password: task.password,
      });
      const written = extracted.ok ? extracted.value.extractedFiles[0] : undefined;
      if (!extracted.ok || !written) {
        await cleanupAll();
        return extracted.ok
          ? err({
              code: 'EXTRACTION_FAILED',
              path: task.sourcePath,
              reason: `${step.entryPath} not found`,
            })
          : extracted;
      }
      prepared = await prepareArchiveSource(path.join(tempDir, written));
      if (!prepared.ok) {
        await cleanupAll();
        return prepared;
      }
      cleanups.push(prepared.value.cleanup);
    }

    return ok({ ...prepared.value, cleanup: cleanupAll });
  }

  /**
   * Where an add-on is extracted before it moves into place: a hidden folder on the
   * same volume as the target, so the move is one rename. The X-Plane folder comes
   * first, then the target's parent; the OS temp folder is the last resort and may
   * sit on another drive.
   */
  private async stagingDir(targetPath: string): Promise<string> {
    const name = `.xdispatch-staging-${crypto.randomUUID()}`;
    const bases = [this.xplanePath, path.dirname(targetPath), os.tmpdir()];
    for (const base of bases) {
      const dir = path.join(base, name);
      try {
        await fs.promises.mkdir(dir, { recursive: true });
        return dir;
      } catch {
        // Not writable here: try the next base.
      }
    }
    throw Object.assign(new Error(`No writable staging folder for ${targetPath}`), {
      code: 'EACCES',
    });
  }

  /**
   * Install a single task
   */
  private async installTask(
    task: InstallTask,
    onProgress: (bytes: number, file: string) => void
  ): Promise<InstallResult> {
    let tempDir: string | null = null;
    let source: OpenedSource | null = null;

    try {
      tempDir = await this.stagingDir(task.targetPath);

      const opened = await this.openSource(task);
      if (!opened.ok) {
        logger.addon.warn(`Cannot open ${task.displayName}: ${opened.error.code}`);
        return {
          taskId: task.id,
          success: false,
          error: getInstallerErrorMessage(opened.error),
          errorCode: opened.error.code,
        };
      }
      source = opened.value;

      // Extract to the staging folder
      const extractResult = await extractArchive(source.format, {
        archivePath: source.readPath,
        volumes: source.volumes,
        targetDir: tempDir,
        internalRoot: task.archiveInternalRoot,
        password: task.password,
        onProgress,
      });

      if (!extractResult.ok) {
        logger.addon.warn(`Extraction failed for ${task.displayName}: ${extractResult.error.code}`);
        return {
          taskId: task.id,
          success: false,
          error: getInstallerErrorMessage(extractResult.error),
          errorCode: extractResult.error.code,
        };
      }

      // Option folders never install as such: the chosen one is laid over the base below.
      for (const variant of task.variants ?? []) {
        const relative = variantRelativeDir(variant.root, task.archiveInternalRoot);
        if (relative) {
          await fs.promises.rm(path.join(tempDir, ...relative.split('/')), {
            recursive: true,
            force: true,
          });
        }
      }

      // The folder must look like an add-on of its type before anything on disk changes.
      const problem = await verifyMarkers(tempDir, task.addonType);
      if (problem) {
        const error: InstallerError = {
          code: 'VERIFY_MARKERS',
          path: task.targetPath,
          problem,
        };
        logger.addon.warn(`Extracted ${task.displayName} is not a ${task.addonType}: ${problem}`);
        return {
          taskId: task.id,
          success: false,
          error: getInstallerErrorMessage(error),
          errorCode: error.code,
        };
      }

      // Handle installation mode
      let backupPath: string | undefined;
      if (task.installMode === 'clean' && task.conflictExists) {
        backupPath = await this.backupBeforeClean(task, tempDir);
        await this.removeBeforeClean(task, tempDir);
      }

      // Move/merge to target
      await fs.promises.mkdir(path.dirname(task.targetPath), { recursive: true });

      if (fs.existsSync(task.targetPath)) {
        // Overwrite keeps files the new version does not replace; a clean install
        // only gets here for navdata, where Custom Data is shared.
        await this.copyMerge(tempDir, task.targetPath);
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      } else {
        await moveIntoPlace(tempDir, task.targetPath);
      }
      tempDir = null;

      if (backupPath) await this.restoreAfterClean(task, backupPath);

      const variant = task.variants?.find((candidate) => candidate.root === task.variant);
      if (variant) await applyVariant(source, task, variant, variant.files);

      // Prove placement: every listed file sits in the final folder at full size.
      const verified = await this.verifyInstall(task, source, variant);
      if (!verified.ok) {
        return {
          taskId: task.id,
          success: false,
          error: getInstallerErrorMessage(verified.error),
          errorCode: verified.error.code,
          errorParams:
            verified.error.code === 'VERIFY_FAILED'
              ? { files: verified.error.files.join(', ') }
              : undefined,
          backupPath,
        };
      }

      return {
        taskId: task.id,
        success: true,
        backupPath,
        verificationStats: verified.value,
      };
    } catch (e) {
      logger.addon.error(`Install failed for ${task.displayName}`, e);
      return {
        taskId: task.id,
        success: false,
        error: String(e),
        errorCode: (e as NodeJS.ErrnoException | null)?.code ?? 'UNKNOWN',
      };
    } finally {
      if (tempDir) await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      await source?.cleanup();
    }
  }

  /**
   * Compare the install folder with the archive's listing. A missing or short file
   * is extracted again on its own, a few times, before the install counts as failed.
   */
  private async verifyInstall(
    task: InstallTask,
    source: OpenedSource,
    variant?: SceneryVariant
  ): Promise<Result<VerificationStats, InstallerError>> {
    const listed = await listArchiveEntries(source, task.password);
    if (!listed.ok) return listed;
    let expected = expectedFiles(listed.value, {
      internalRoot: task.archiveInternalRoot,
      exclude: (task.variants ?? []).map((candidate) => candidate.root),
    });
    if (variant) expected = withVariant(expected, variant);

    let { stats, misplaced } = await verifyPlacement(task.targetPath, expected);
    for (
      let attempt = 1;
      misplaced.length > 0 && attempt <= INSTALLER_CONSTANTS.VERIFY_RETRIES;
      attempt++
    ) {
      logger.addon.warn(
        `${misplaced.length} file(s) of ${task.displayName} not in place, re-extracting (attempt ${attempt})`
      );
      const fromBase = misplaced.filter((file) => !file.fromVariant);
      if (fromBase.length > 0) {
        await extractArchive(source.format, {
          archivePath: source.readPath,
          volumes: source.volumes,
          targetDir: task.targetPath,
          internalRoot: task.archiveInternalRoot,
          password: task.password,
          only: fromBase.map((file) => file.entryPath),
        });
      }
      const fromVariant = new Set(misplaced.filter((f) => f.fromVariant).map((f) => f.entryPath));
      if (variant && fromVariant.size > 0) {
        await applyVariant(
          source,
          task,
          variant,
          variant.files.filter((file) => fromVariant.has(file.source))
        );
      }
      ({ stats, misplaced } = await verifyPlacement(task.targetPath, expected));
    }

    if (misplaced.length > 0) {
      const named = misplaced
        .slice(0, INSTALLER_CONSTANTS.VERIFY_FAILED_NAMED_FILES)
        .map((file) => file.relative);
      if (misplaced.length > named.length) named.push(`+${misplaced.length - named.length}`);
      logger.addon.warn(
        `Verification failed for ${task.displayName}: ${misplaced.length} of ${expected.length} files`
      );
      return err({ code: 'VERIFY_FAILED', path: task.targetPath, files: named });
    }
    return ok(stats);
  }

  /**
   * Save what a clean install would lose: the aircraft's liveries, its settings
   * files, and the navdata files the new package replaces. Returns the backup
   * folder, or undefined when there was nothing to keep.
   */
  private async backupBeforeClean(
    task: InstallTask,
    stagedDir: string
  ): Promise<string | undefined> {
    if (!task.conflictExists) return undefined;

    const backupDir = `${task.targetPath}.backup_${Date.now()}`;
    let saved = false;

    if (task.backupOptions.liveries) {
      const liveriesDir = path.join(task.targetPath, 'liveries');
      if (fs.existsSync(liveriesDir)) {
        const backupLiveries = path.join(backupDir, 'liveries');
        await fs.promises.mkdir(backupLiveries, { recursive: true });
        await fs.promises.cp(liveriesDir, backupLiveries, { recursive: true });
        await assertSameTree(liveriesDir, backupLiveries, 'liveries backup');
        saved = true;
      }
    }

    if (task.backupOptions.configFiles && task.backupOptions.configPatterns.length > 0) {
      for (const pattern of task.backupOptions.configPatterns) {
        // Simple glob matching for common patterns
        const files = await this.findMatchingFiles(task.targetPath, pattern);
        for (const file of files) {
          const relativePath = path.relative(task.targetPath, file);
          const backupPath = path.join(backupDir, relativePath);
          await fs.promises.mkdir(path.dirname(backupPath), { recursive: true });
          await fs.promises.copyFile(file, backupPath);
          saved = true;
        }
      }
    }

    if (task.backupOptions.navdata) {
      // Custom Data is shared by every provider: only what the new package replaces moves
      for (const name of await this.replacedEntries(task, stagedDir)) {
        const existing = path.join(task.targetPath, name);
        await fs.promises.mkdir(backupDir, { recursive: true });
        await fs.promises.cp(existing, path.join(backupDir, name), { recursive: true });
        saved = true;
      }
    }

    return saved ? backupDir : undefined;
  }

  /** Top-level entries of the target that the staged install also provides. */
  private async replacedEntries(task: InstallTask, stagedDir: string): Promise<string[]> {
    const staged = await fs.promises.readdir(stagedDir).catch(() => [] as string[]);
    return staged.filter((name) => fs.existsSync(path.join(task.targetPath, name)));
  }

  /** The clean part of a clean install: the old folder goes, or for navdata, the replaced files. */
  private async removeBeforeClean(task: InstallTask, stagedDir: string): Promise<void> {
    if (task.addonType === 'Navdata') {
      for (const name of await this.replacedEntries(task, stagedDir)) {
        await fs.promises.rm(path.join(task.targetPath, name), { recursive: true, force: true });
      }
      return;
    }
    await fs.promises.rm(task.targetPath, { recursive: true, force: true });
  }

  /**
   * Put liveries and settings back into the fresh install. A file the new version
   * ships wins over the saved copy, so an updater's own config is never rolled back;
   * navdata stays in the backup.
   */
  private async restoreAfterClean(task: InstallTask, backupDir: string): Promise<void> {
    const liveries = path.join(backupDir, 'liveries');
    if (task.backupOptions.liveries && fs.existsSync(liveries)) {
      const target = path.join(task.targetPath, 'liveries');
      await fs.promises.mkdir(target, { recursive: true });
      for (const entry of await fs.promises.readdir(liveries)) {
        const dst = path.join(target, entry);
        // A livery the new version ships wins over the saved copy
        if (fs.existsSync(dst)) continue;
        await fs.promises.cp(path.join(liveries, entry), dst, { recursive: true });
      }
    }

    if (task.backupOptions.configFiles) {
      for (const pattern of task.backupOptions.configPatterns) {
        for (const file of await this.findMatchingFiles(backupDir, pattern)) {
          const relativePath = path.relative(backupDir, file);
          if (relativePath.split(path.sep)[0] === 'liveries') continue;
          const dst = path.join(task.targetPath, relativePath);
          if (fs.existsSync(dst)) continue;
          await fs.promises.mkdir(path.dirname(dst), { recursive: true });
          await fs.promises.copyFile(file, dst);
        }
      }
    }
  }

  /**
   * Find files matching a simple glob pattern
   */
  private async findMatchingFiles(dir: string, pattern: string): Promise<string[]> {
    const results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');

    const walk = async (currentDir: string): Promise<void> => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else if (regex.test(entry.name)) {
          results.push(fullPath);
        }
      }
    };

    await walk(dir);
    return results;
  }

  /**
   * Copy source into dest, merging directories
   */
  private async copyMerge(src: string, dst: string): Promise<void> {
    if (!fs.existsSync(src)) return;
    await mergeInto(src, dst);
  }
}
