/**
 * Install transaction.
 *
 * Everything an install touches is journalled before it is touched: files it
 * replaces are copied into a backup folder, files it creates are recorded. If
 * any component fails the journal is replayed backwards and the X-Plane folder
 * ends up exactly as it was.
 */
import type { Dirent } from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import logger from '@/lib/utils/logger';

export interface StagedComponent {
  /** Folder holding the extracted, verified files */
  tempDir: string;
  /** Where those files belong */
  targetPath: string;
  /** Replace the target outright instead of merging into it */
  clean: boolean;
}

type JournalEntry =
  | { kind: 'movedAside'; target: string; backup: string }
  | { kind: 'replacedFile'; target: string; backup: string }
  | { kind: 'createdFile'; target: string }
  | { kind: 'createdDir'; target: string };

/** Backup folders kept per X-Plane install before the oldest are pruned. */
const MAX_BACKUP_SETS = 5;

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 60) || 'addon';
}

async function exists(target: string): Promise<boolean> {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  let entries: Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(dir, entry.name), rel)));
    } else {
      files.push(rel);
    }
  }
  return files;
}

/**
 * Move a path, falling back to a copy when the two sides are on different
 * volumes (temp on C:, X-Plane on D:).
 */
async function movePath(source: string, destination: string): Promise<void> {
  try {
    await fsp.rename(source, destination);
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
  }
  await fsp.cp(source, destination, { recursive: true, force: true });
  await fsp.rm(source, { recursive: true, force: true });
}

export class InstallTransaction {
  private readonly journal: JournalEntry[] = [];
  private readonly backupDir: string;
  private backupUsed = false;

  constructor(backupRoot: string, label: string) {
    this.backupDir = path.join(backupRoot, `${sanitize(label)}_${Date.now()}`);
  }

  /**
   * Path of the backup folder, once anything has been backed up into it.
   */
  getBackupPath(): string | null {
    return this.backupUsed ? this.backupDir : null;
  }

  /**
   * Move every staged component into place, recording what changed.
   * Throws on the first failure; the caller is expected to roll back.
   */
  async apply(components: StagedComponent[]): Promise<void> {
    for (let i = 0; i < components.length; i++) {
      const component = components[i];
      if (!component) continue;

      if (component.clean && (await exists(component.targetPath))) {
        const aside = path.join(this.backupDir, `${i}_${path.basename(component.targetPath)}`);
        await this.ensureBackupDir(path.dirname(aside));
        await movePath(component.targetPath, aside);
        this.journal.push({ kind: 'movedAside', target: component.targetPath, backup: aside });
      }

      await this.mergeInto(component, i);
    }
  }

  /**
   * Undo everything the transaction did, newest change first.
   */
  async rollback(): Promise<void> {
    for (let i = this.journal.length - 1; i >= 0; i--) {
      const entry = this.journal[i];
      if (!entry) continue;
      try {
        switch (entry.kind) {
          case 'movedAside':
            await fsp.rm(entry.target, { recursive: true, force: true });
            await movePath(entry.backup, entry.target);
            break;
          case 'replacedFile':
            await fsp.copyFile(entry.backup, entry.target);
            break;
          case 'createdFile':
            await fsp.rm(entry.target, { force: true });
            break;
          case 'createdDir':
            await fsp.rmdir(entry.target).catch(() => undefined);
            break;
        }
      } catch (e) {
        logger.addon.error(`Rollback step failed for ${entry.target}: ${e}`);
      }
    }
    this.journal.length = 0;
  }

  /**
   * Delete backup folders beyond the most recent few.
   */
  static async pruneBackups(backupRoot: string): Promise<void> {
    let entries: Dirent[];
    try {
      entries = await fsp.readdir(backupRoot, { withFileTypes: true });
    } catch {
      return;
    }

    const dirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(backupRoot, e.name));
    if (dirs.length <= MAX_BACKUP_SETS) return;

    const withTime = await Promise.all(
      dirs.map(async (dir) => ({
        dir,
        time: await fsp
          .stat(dir)
          .then((s) => s.mtimeMs)
          .catch(() => 0),
      }))
    );

    withTime.sort((a, b) => b.time - a.time);
    for (const stale of withTime.slice(MAX_BACKUP_SETS)) {
      await fsp.rm(stale.dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  private async ensureBackupDir(dir: string): Promise<void> {
    await fsp.mkdir(dir, { recursive: true });
    this.backupUsed = true;
  }

  /**
   * Copy the staged files over the target one by one, journalling each.
   */
  private async mergeInto(component: StagedComponent, index: number): Promise<void> {
    const files = await listFiles(component.tempDir);

    await this.ensureDir(component.targetPath);

    for (const relative of files) {
      const source = path.join(component.tempDir, relative);
      const destination = path.join(component.targetPath, relative);

      await this.ensureDir(path.dirname(destination));

      if (await exists(destination)) {
        const backup = path.join(this.backupDir, String(index), relative);
        await this.ensureBackupDir(path.dirname(backup));
        await fsp.copyFile(destination, backup);
        this.journal.push({ kind: 'replacedFile', target: destination, backup });
      } else {
        this.journal.push({ kind: 'createdFile', target: destination });
      }

      await fsp.copyFile(source, destination);
    }
  }

  /**
   * Create a directory, recording only the levels that did not already exist so
   * a rollback does not remove folders that were there before.
   */
  private async ensureDir(dir: string): Promise<void> {
    if (await exists(dir)) return;

    const missing: string[] = [];
    let current = dir;
    while (!(await exists(current))) {
      missing.push(current);
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    await fsp.mkdir(dir, { recursive: true });
    for (const created of missing) {
      this.journal.push({ kind: 'createdDir', target: created });
    }
  }
}
