/**
 * Moving a staged add-on into its final folder. A rename on the same volume is one
 * atomic step; across volumes the copy goes next to the destination first, so the
 * last step is still a rename and a half-copied folder never carries the real name.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import { INSTALLER_CONSTANTS } from './types';
import { treeSummary } from './verify';

/** Drop read-only bits so a rename or delete can proceed on Windows. */
async function clearReadonly(root: string): Promise<void> {
  const walk = async (current: string): Promise<void> => {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      await fs.promises.chmod(full, entry.isDirectory() ? 0o777 : 0o666).catch(() => {});
      if (entry.isDirectory()) await walk(full);
    }
  };
  await fs.promises.chmod(root, 0o777).catch(() => {});
  await walk(root);
}

/**
 * Rename with a few short waits: a virus scanner or an indexer often holds a
 * freshly written folder for a moment. A missing source is never retried.
 */
export async function renameWithRetry(src: string, dst: string): Promise<void> {
  let lastError: unknown;
  const waits = INSTALLER_CONSTANTS.RENAME_BACKOFF_MS;
  for (let attempt = 0; attempt < waits.length; attempt++) {
    const wait = waits[attempt] ?? 0;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    if (attempt > 0) await clearReadonly(src);
    try {
      await fs.promises.rename(src, dst);
      return;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'ENOENT' || code === 'EXDEV') throw e;
      lastError = e;
    }
  }
  throw lastError;
}

/**
 * Put `src` at `dst`. On another volume, copy into a temporary folder beside `dst`
 * and rename that; the staging source is then deleted, and a failure to delete it
 * is logged rather than failing an install that is already complete.
 */
export async function moveIntoPlace(src: string, dst: string): Promise<void> {
  try {
    await renameWithRetry(src, dst);
    return;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'EXDEV') throw e;
  }
  logger.addon.info(`Staging folder is on another volume than ${dst}; copying`);
  const parent = path.dirname(dst);
  const stage = path.join(parent, `.xdispatch-move-${crypto.randomUUID()}`);
  try {
    await fs.promises.cp(src, stage, { recursive: true });
    await renameWithRetry(stage, dst);
  } catch (e) {
    await fs.promises.rm(stage, { recursive: true, force: true }).catch(() => {});
    throw e;
  }
  try {
    await fs.promises.rm(src, { recursive: true, force: true });
  } catch (e) {
    logger.addon.warn(`Could not remove staging folder ${src} after the move`, e);
  }
}

/**
 * Copy `src` over `dst`, folder into folder. A file in the way of a folder, or a
 * folder in the way of a file, is removed first: `fs.cp` refuses both
 * (ERR_FS_CP_DIR_TO_NON_DIR), and an overwrite install must win either way. A
 * link to a folder is followed, not replaced: a CSL folder linked from another
 * drive keeps receiving its packages.
 */
export async function mergeInto(src: string, dst: string): Promise<void> {
  await fs.promises.mkdir(dst, { recursive: true });
  const entries = await fs.promises.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = path.join(src, entry.name);
    const to = path.join(dst, entry.name);
    const link = await fs.promises.lstat(to).catch(() => null);
    // What is really there, through a link; a dangling link counts as nothing.
    const existing = link ? await fs.promises.stat(to).catch(() => null) : null;
    if (link && !existing) await fs.promises.rm(to, { force: true });
    if (entry.isDirectory()) {
      if (existing && !existing.isDirectory()) {
        await fs.promises.rm(to, { force: true });
      }
      await mergeInto(from, to);
      continue;
    }
    if (existing?.isDirectory()) {
      await fs.promises.rm(to, { recursive: true, force: true });
    }
    await fs.promises.copyFile(from, to);
  }
}

/** Fail before anything is deleted when a backup copy is not the whole tree. */
export async function assertSameTree(src: string, copy: string, what: string): Promise<void> {
  const [a, b] = await Promise.all([treeSummary(src), treeSummary(copy)]);
  if (a.files !== b.files || a.bytes !== b.bytes) {
    throw Object.assign(
      new Error(
        `${what} is incomplete: ${b.files} of ${a.files} files, ${b.bytes} of ${a.bytes} bytes`
      ),
      { code: 'INSTALL_FAILED' }
    );
  }
}
