/**
 * ZIP Extraction Module
 * Extracts ZIP files with size verification and progress tracking.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError, VerificationStats } from '../types';
import { containsPath, sanitizeEntryPath, shouldIgnore, stripInternalRoot } from './entryPaths';

export interface ExtractOptions {
  /** Archive path */
  archivePath: string;
  /** Target directory */
  targetDir: string;
  /** Internal root to strip from paths (e.g., "MyAddon/") */
  internalRoot?: string;
  /** Password for encrypted archives */
  password?: string;
  /** Progress callback: (bytesWritten, currentFile) */
  onProgress?: (bytes: number, file: string) => void;
  /** Checked between entries so a large archive stops promptly */
  isCancelled?: () => boolean;
}

export interface ExtractResult {
  stats: VerificationStats;
  extractedFiles: string[];
}

/**
 * Extract a ZIP archive
 */
export async function extractZip(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, onProgress, isCancelled } = options;

  return new Promise((resolve) => {
    yauzl.open(archivePath, { lazyEntries: true }, (openErr, zipFile) => {
      if (openErr || !zipFile) {
        resolve(
          err({
            code: 'EXTRACTION_FAILED',
            path: archivePath,
            reason: openErr?.message ?? 'Failed to open ZIP file',
          })
        );
        return;
      }

      const stats: VerificationStats = {
        totalFiles: 0,
        verifiedFiles: 0,
        failedFiles: 0,
        skippedFiles: 0,
      };
      const extractedFiles: string[] = [];
      let hasError = false;

      const processEntry = () => {
        zipFile.readEntry();
      };

      zipFile.on('entry', (entry: yauzl.Entry) => {
        if (hasError) return;

        if (isCancelled?.()) {
          hasError = true;
          zipFile.close();
          resolve(err({ code: 'CANCELLED', path: archivePath }));
          return;
        }

        const entryPath = entry.fileName;

        // Directories are created as their files are written
        if (entryPath.endsWith('/')) {
          processEntry();
          return;
        }

        if (shouldIgnore(entryPath)) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        const relativePath = stripInternalRoot(entryPath, internalRoot);
        if (relativePath === null) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        const sanitized = sanitizeEntryPath(relativePath);
        if (!sanitized) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        const outPath = path.join(targetDir, sanitized);
        if (!containsPath(targetDir, outPath)) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        stats.totalFiles++;

        try {
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
        } catch {
          stats.failedFiles++;
          processEntry();
          return;
        }

        zipFile.openReadStream(entry, (streamErr, readStream) => {
          if (streamErr || !readStream) {
            stats.failedFiles++;
            processEntry();
            return;
          }

          const writeStream = fs.createWriteStream(outPath);
          let bytesWritten = 0;
          let hasStreamError = false;

          readStream.on('data', (chunk: Buffer) => {
            bytesWritten += chunk.length;
          });

          writeStream.on('close', () => {
            if (hasStreamError) return;
            if (bytesWritten === entry.uncompressedSize) {
              stats.verifiedFiles++;
              extractedFiles.push(sanitized);
            } else {
              stats.failedFiles++;
            }
            onProgress?.(bytesWritten, sanitized);
            processEntry();
          });

          readStream.on('error', () => {
            hasStreamError = true;
            stats.failedFiles++;
            writeStream.destroy();
            processEntry();
          });

          writeStream.on('error', () => {
            hasStreamError = true;
            stats.failedFiles++;
            readStream.destroy();
            processEntry();
          });

          readStream.pipe(writeStream);
        });
      });

      zipFile.on('end', () => {
        zipFile.close();
        if (!hasError) {
          resolve(ok({ stats, extractedFiles }));
        }
      });

      zipFile.on('error', (readErr) => {
        hasError = true;
        zipFile.close();
        resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: readErr.message }));
      });

      processEntry();
    });
  });
}
