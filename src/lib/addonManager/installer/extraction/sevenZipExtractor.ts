/**
 * 7-Zip Extraction Module
 * Extracts 7z archives using node-7z with progress tracking.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError, VerificationStats } from '../types';
import { listFilesRecursive, moveTree, normalizeInternalRoot, pruneIgnored } from './entryPaths';
import type { ExtractOptions, ExtractResult } from './zipExtractor';

/**
 * Get path to bundled 7zip binary
 */
async function get7zipPath(): Promise<string> {
  const sevenZipBin = await import('7zip-bin');
  return sevenZipBin.path7za;
}

/**
 * Extract a 7z archive.
 *
 * 7za writes the files itself, so the archive is unpacked into a staging
 * folder first. Only the requested internal root is then moved into the
 * target, which is what keeps sibling folders out of the install.
 */
export async function extractSevenZip(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, password, onProgress } = options;

  const node7z = await import('node-7z');
  const extractFull = node7z.default?.extractFull ?? node7z.extractFull;
  const pathTo7zip = await get7zipPath();

  const staging = path.join(targetDir, `.xdispatch-staging-${process.pid}-${Date.now()}`);

  return new Promise((resolve) => {
    const finish = (result: Result<ExtractResult, InstallerError>) => {
      fs.rmSync(staging, { recursive: true, force: true });
      resolve(result);
    };

    try {
      fs.mkdirSync(staging, { recursive: true });

      const extractStream = extractFull(archivePath, staging, {
        $bin: pathTo7zip,
        recursive: true,
        password: password,
      });

      extractStream.on('data', (data: { file: string; status?: string }) => {
        if (data.file) onProgress?.(0, data.file);
      });

      extractStream.on('end', () => {
        const skippedFiles = pruneIgnored(staging);

        const root = internalRoot ? normalizeInternalRoot(internalRoot).replace(/\/$/, '') : '';
        const sourceDir = root ? path.join(staging, ...root.split('/')) : staging;

        if (!fs.existsSync(sourceDir)) {
          finish(
            err({
              code: 'EXTRACTION_FAILED',
              path: archivePath,
              reason: `Archive has no folder "${root}"`,
            })
          );
          return;
        }

        const extractedFiles = listFilesRecursive(sourceDir);
        const { moved, failed } = moveTree(sourceDir, targetDir);

        const stats: VerificationStats = {
          totalFiles: extractedFiles.length,
          verifiedFiles: moved,
          failedFiles: failed + Math.max(0, extractedFiles.length - moved - failed),
          skippedFiles,
        };

        finish(ok({ stats, extractedFiles }));
      });

      extractStream.on('error', (extractErr: Error) => {
        if (extractErr.message.includes('password') || extractErr.message.includes('Wrong')) {
          finish(err({ code: 'PASSWORD_REQUIRED', path: archivePath }));
        } else {
          finish(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: extractErr.message }));
        }
      });
    } catch (e) {
      finish(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) }));
    }
  });
}
