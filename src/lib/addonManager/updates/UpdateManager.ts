/**
 * Applies SkunkCrafts updates to an installed addon.
 *
 * Downloads are staged and verified in full before anything in X-Plane is
 * touched, and the move itself runs through the install transaction, so a
 * failed update leaves the addon exactly as it was.
 */
import * as crypto from 'crypto';
import * as fsp from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import { InstallTransaction } from '../installer/transaction';
import {
  type DownloadProgress,
  type SkunkCraftsManifest,
  type UpdateError,
  type UpdatePlan,
  downloadUpdate,
  fetchManifest,
  planUpdate,
} from './skunkcrafts';

const CFG_FILE = 'skunkcrafts_updater.cfg';

export type UpdateTargetType = 'aircraft' | 'plugin';

export interface UpdateStatus {
  folderName: string;
  localVersion: string;
  remoteVersion: string;
  hasUpdate: boolean;
  changedFiles: number;
  removedFiles: number;
  downloadBytes: number;
}

export interface ApplyUpdateResult {
  folderName: string;
  version: string;
  updatedFiles: number;
  removedFiles: number;
  backupPath?: string;
}

export interface ApplyOptions {
  onProgress?: (progress: DownloadProgress) => void;
  isCancelled?: () => boolean;
}

export type UpdateManagerError =
  UpdateError | { code: 'NOT_FOUND'; path: string } | { code: 'NOT_CONFIGURED'; path: string };

interface LocalConfig {
  folder: string;
  cfgPath: string;
  version: string;
  updateUrl: string;
}

export class UpdateManager {
  private readonly xplanePath: string;

  constructor(xplanePath: string) {
    this.xplanePath = xplanePath;
  }

  /**
   * Locate an addon folder, refusing anything that escapes its base directory.
   */
  private resolveFolder(type: UpdateTargetType, folderName: string): string | null {
    if (!folderName || folderName.includes('..') || folderName.length > 500) return null;

    const base =
      type === 'aircraft'
        ? path.join(this.xplanePath, 'Aircraft')
        : path.join(this.xplanePath, 'Resources', 'plugins');

    const resolved = path.resolve(path.join(base, folderName));
    if (!resolved.startsWith(path.resolve(base) + path.sep)) return null;
    return resolved;
  }

  private async readLocalConfig(
    type: UpdateTargetType,
    folderName: string
  ): Promise<Result<LocalConfig, UpdateManagerError>> {
    const folder = this.resolveFolder(type, folderName);
    if (!folder) return err({ code: 'NOT_FOUND', path: folderName });

    const cfgPath = path.join(folder, CFG_FILE);
    let content: string;
    try {
      content = await fsp.readFile(cfgPath, 'utf-8');
    } catch {
      return err({ code: 'NOT_CONFIGURED', path: folderName });
    }

    let version = '';
    let updateUrl = '';
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.startsWith('version|')) version = trimmed.slice('version|'.length).trim();
      if (trimmed.startsWith('module|')) updateUrl = trimmed.slice('module|'.length).trim();
    }

    if (!updateUrl) return err({ code: 'NOT_CONFIGURED', path: folderName });

    return ok({ folder, cfgPath, version, updateUrl });
  }

  private async load(
    type: UpdateTargetType,
    folderName: string
  ): Promise<
    Result<
      { config: LocalConfig; manifest: SkunkCraftsManifest; plan: UpdatePlan },
      UpdateManagerError
    >
  > {
    const config = await this.readLocalConfig(type, folderName);
    if (!config.ok) return config;

    const manifest = await fetchManifest(config.value.updateUrl);
    if (!manifest.ok) return manifest;

    const plan = await planUpdate(config.value.folder, manifest.value);
    return ok({ config: config.value, manifest: manifest.value, plan });
  }

  /**
   * What an update would change, without changing anything.
   */
  async check(
    type: UpdateTargetType,
    folderName: string
  ): Promise<Result<UpdateStatus, UpdateManagerError>> {
    const loaded = await this.load(type, folderName);
    if (!loaded.ok) return loaded;

    const { config, plan } = loaded.value;

    return ok({
      folderName,
      localVersion: config.version,
      remoteVersion: plan.version,
      hasUpdate: plan.download.length > 0 || plan.remove.length > 0,
      changedFiles: plan.download.length,
      removedFiles: plan.remove.length,
      downloadBytes: plan.downloadBytes,
    });
  }

  /**
   * Download and apply the update.
   */
  async apply(
    type: UpdateTargetType,
    folderName: string,
    options: ApplyOptions = {}
  ): Promise<Result<ApplyUpdateResult, UpdateManagerError>> {
    const loaded = await this.load(type, folderName);
    if (!loaded.ok) return loaded;

    const { config, manifest, plan } = loaded.value;

    if (plan.download.length === 0 && plan.remove.length === 0) {
      return ok({
        folderName,
        version: plan.version || config.version,
        updatedFiles: 0,
        removedFiles: 0,
      });
    }

    const staging = path.join(os.tmpdir(), `xdispatch_update_${crypto.randomUUID()}`);
    const backupRoot = path.join(this.xplanePath, 'Output', 'xdispatch_backups');
    const transaction = new InstallTransaction(backupRoot, `${folderName}_update`);

    try {
      await fsp.mkdir(staging, { recursive: true });

      const downloaded = await downloadUpdate(manifest, plan, staging, options);
      if (!downloaded.ok) {
        await fsp.rm(staging, { recursive: true, force: true });
        return downloaded;
      }

      if (options.isCancelled?.()) {
        await fsp.rm(staging, { recursive: true, force: true });
        return err({ code: 'CANCELLED' });
      }

      await transaction.apply([{ tempDir: staging, targetPath: config.folder, clean: false }]);

      // Removals come last: the download is the part that can fail, and a
      // file deleted before it would be gone for nothing.
      const removed = await this.removeBlacklisted(config.folder, plan.remove, transaction);

      await fsp.rm(staging, { recursive: true, force: true });
      await InstallTransaction.pruneBackups(backupRoot);

      const version = plan.version || config.version;
      await this.writeLocalVersion(config.cfgPath, version);

      const backupPath = transaction.getBackupPath();

      return ok({
        folderName,
        version,
        updatedFiles: downloaded.value.length,
        removedFiles: removed,
        ...(backupPath ? { backupPath } : {}),
      });
    } catch (e) {
      logger.addon.error(`Update failed for ${folderName}, rolling back: ${e}`);
      await transaction.rollback();
      await fsp.rm(staging, { recursive: true, force: true }).catch(() => undefined);
      return err({
        code: 'WRITE_FAILED',
        path: folderName,
        reason: e instanceof Error ? e.message : String(e),
      });
    }
  }

  /**
   * Delete the files the manifest retired, keeping a copy alongside the
   * transaction's backup so the change stays reversible by hand.
   */
  private async removeBlacklisted(
    folder: string,
    relativePaths: string[],
    transaction: InstallTransaction
  ): Promise<number> {
    if (relativePaths.length === 0) return 0;

    const backupDir = transaction.getBackupPath() ?? path.join(folder, '..', '.xdispatch-removed');
    let removed = 0;

    for (const relative of relativePaths) {
      const target = path.join(folder, ...relative.split('/'));
      try {
        const backup = path.join(backupDir, 'removed', ...relative.split('/'));
        await fsp.mkdir(path.dirname(backup), { recursive: true });
        await fsp.copyFile(target, backup);
        await fsp.rm(target, { force: true });
        removed++;
      } catch (e) {
        logger.addon.warn(`Could not remove retired file ${relative}: ${e}`);
      }
    }

    return removed;
  }

  /**
   * Keep the local cfg's version in step, for addons whose manifest does not
   * ship the cfg itself.
   */
  private async writeLocalVersion(cfgPath: string, version: string): Promise<void> {
    if (!version) return;

    try {
      const content = await fsp.readFile(cfgPath, 'utf-8');
      const lines = content.split(/\r?\n/);
      const index = lines.findIndex((line) => line.trim().startsWith('version|'));
      if (index === -1) lines.unshift(`version|${version}`);
      else lines[index] = `version|${version}`;
      await fsp.writeFile(cfgPath, lines.join('\n'), 'utf-8');
    } catch (e) {
      logger.addon.warn(`Could not update local version for ${cfgPath}: ${e}`);
    }
  }
}
