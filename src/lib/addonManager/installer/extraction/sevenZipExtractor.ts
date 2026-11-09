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
 * The whole stderr of the 7-Zip process behind a node-7z stream.
 *
 * node-7z makes one Error per stderr chunk and merges them first-chunk-wins
 * (its error.js `assign`). `7z l` writes a blank line before the error, so when
 * the OS delivers that line as its own chunk the password failure is lost and
 * the stream reports "unknown error" (CI, 2026-11-09). The stream carries its
 * child process from creation; its stderr is read whole here, attached in the
 * same tick so no chunk is missed.
 */
export function collectSevenZipStderr(stream: unknown): () => string {
  let text = '';
  const child = (stream as { _childProcess?: { stderr?: NodeJS.ReadableStream | null } })
    ._childProcess;
  child?.stderr?.on('data', (chunk: Buffer | string) => {
    text += chunk.toString();
  });
  return () => text;
}

/**
 * A packaged app resolves the bundled binary to a path inside app.asar, which
 * is a file: spawning from it fails with ENOENT on Windows and ENOTDIR on
 * Linux (Sentry X-DISPATCH-7F). The build unpacks 7zip-bin next to the
 * archive, so the executable lives under app.asar.unpacked.
 */
export function unpackedBinaryPath(binaryPath: string): string {
  return binaryPath.replace(/app\.asar(?=[\\/])/, 'app.asar.unpacked');
}

/**
 * Get path to bundled 7zip binary
 */
export async function get7zipPath(): Promise<string> {
  const sevenZipBin = await import('7zip-bin');
  return unpackedBinaryPath(sevenZipBin.path7za);
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
      const stderr = collectSevenZipStderr(extractStream);

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
        resolve(
          err(
            sevenZipErrorCode(
              { message: extractErr.message, stderr: stderr() || extractErr.stderr },
              archivePath,
              password
            )
          )
        );
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
