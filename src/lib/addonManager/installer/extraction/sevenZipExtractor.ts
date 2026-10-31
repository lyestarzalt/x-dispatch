/**
 * 7-Zip Extraction Module
 * Extracts 7z archives (and encrypted zips) using node-7z with progress tracking.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError } from '../types';
import type { ExtractOptions, ExtractResult } from './options';
import { emptyStats, resolveEntryTarget } from './options';

/**
 * 7-Zip asks for a password on its terminal when an archive needs one and none was
 * given, and node-7z would wait on that forever. A password is therefore always
 * passed: an unencrypted archive ignores it, an encrypted one fails at once with
 * "Wrong password", which maps to PASSWORD_REQUIRED when the user typed nothing.
 */
export const SEVEN_ZIP_NO_PASSWORD = 'x-dispatch-no-password';

export function sevenZipPassword(password: string | undefined): string {
  return password || SEVEN_ZIP_NO_PASSWORD;
}

/** node-7z errors carry 7-Zip's text in `stderr`; `message` alone can be "unknown error". */
export interface SevenZipFailure {
  message?: string;
  stderr?: string;
}

/** The installer's code for a 7-Zip failure, given whether a password was tried. */
export function sevenZipErrorCode(
  failure: SevenZipFailure | string,
  archivePath: string,
  password: string | undefined
): InstallerError {
  const message =
    typeof failure === 'string'
      ? failure
      : [failure.message, failure.stderr].filter(Boolean).join(' ').trim() || 'unknown error';
  if (/wrong password|encrypted/i.test(message)) {
    return password
      ? { code: 'INVALID_PASSWORD', path: archivePath }
      : { code: 'PASSWORD_REQUIRED', path: archivePath };
  }
  return { code: 'EXTRACTION_FAILED', path: archivePath, reason: message };
}

/**
 * Get path to bundled 7zip binary
 */
export async function get7zipPath(): Promise<string> {
  const sevenZipBin = await import('7zip-bin');
  return sevenZipBin.path7za;
}

/**
 * Extract a 7z archive
 */
export async function extractSevenZip(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, password, only, onProgress } = options;

  const node7z = await import('node-7z');
  const extractFull = node7z.default?.extractFull ?? node7z.extractFull;
  const pathTo7zip = await get7zipPath();

  return new Promise((resolve) => {
    const stats = emptyStats();
    const extractedFiles: string[] = [];
    let settled = false;

    // Create target directory
    fs.mkdirSync(targetDir, { recursive: true });

    // Only the add-on's folder (or the requested entries) leave the archive.
    const cherryPick = only ?? (internalRoot ? [`${internalRoot}*`] : undefined);

    try {
      const extractStream = extractFull(archivePath, targetDir, {
        $bin: pathTo7zip,
        $cherryPick: cherryPick,
        recursive: true,
        password: sevenZipPassword(password),
      });

      extractStream.on('data', (data: { file: string; status?: string }) => {
        const filePath = data.file;
        if (!filePath) return;

        const sanitized = resolveEntryTarget(filePath, options);
        if (!sanitized) {
          stats.skippedFiles++;
          return;
        }

        stats.totalFiles++;
        extractedFiles.push(sanitized);

        // 7-Zip wrote the file at its archive path; the add-on folder is moved up below
        const writtenPath = path.join(targetDir, filePath);
        try {
          const stat = fs.statSync(writtenPath);
          if (stat.isDirectory()) {
            stats.totalFiles--;
            extractedFiles.pop();
            return;
          }
          onProgress?.(stat.size, sanitized);
          stats.verifiedFiles++;
        } catch {
          stats.failedFiles++;
        }
      });

      extractStream.on('end', () => {
        if (settled) return;
        settled = true;
        void (async () => {
          try {
            // If internalRoot is specified, we need to move files from the extracted subfolder
            if (internalRoot) {
              const sourceDir = path.join(targetDir, internalRoot.replace(/\/$/, ''));
              if (fs.existsSync(sourceDir)) {
                // Move contents up
                await moveContentsUp(sourceDir, targetDir);
              }
            }
            resolve(ok({ stats, extractedFiles }));
          } catch (e) {
            resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) }));
          }
        })();
      });

      extractStream.on('error', (extractErr: SevenZipFailure) => {
        if (settled) return;
        settled = true;
        resolve(err(sevenZipErrorCode(extractErr, archivePath, password)));
      });
    } catch (e) {
      resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) }));
    }
  });
}

/**
 * Move contents from a subdirectory up to the parent
 */
async function moveContentsUp(sourceDir: string, targetDir: string): Promise<void> {
  const entries = await fs.promises.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(targetDir, entry.name);

    if (srcPath === targetDir) continue; // Skip if same as target

    try {
      // Same volume, so a rename moves multi-GB folders without copying
      await fs.promises.rename(srcPath, dstPath);
    } catch {
      await fs.promises.cp(srcPath, dstPath, { recursive: true, force: true });
    }
  }

  // The add-on's folder is empty now; remove it and any empty folders above it
  await fs.promises.rm(sourceDir, { recursive: true, force: true });
  let dir = path.dirname(sourceDir);
  while (dir.startsWith(targetDir) && dir !== targetDir) {
    try {
      await fs.promises.rmdir(dir);
    } catch {
      break; // not empty: something of the add-on's lives there
    }
    dir = path.dirname(dir);
  }
}
