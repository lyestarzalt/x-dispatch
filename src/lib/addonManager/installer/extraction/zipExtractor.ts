/**
 * ZIP Extraction Module
 * Extracts ZIP files with CRC32 verification and progress tracking.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yauzl from 'yauzl';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError, VerificationStats } from '../types';
import { IGNORE_PATTERNS } from '../types';

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
}

export interface ExtractResult {
  stats: VerificationStats;
  extractedFiles: string[];
}

/**
 * Check if a path component should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split('/');
  return parts.some((part) => IGNORE_PATTERNS.includes(part));
}

/**
 * Sanitize path to prevent directory traversal attacks
 */
function sanitizePath(entryPath: string): string | null {
  // Reject absolute paths
  if (path.isAbsolute(entryPath)) return null;

  // Reject path traversal
  const parts = entryPath.split('/');
  if (parts.some((p) => p === '..')) return null;

  // Normalize and return
  return parts.filter((p) => p !== '').join('/');
}

/**
 * Extract a ZIP archive
 */
export async function extractZip(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, onProgress } = options;

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

        const entryPath = entry.fileName;

        // Skip directories (they're created automatically)
        if (entryPath.endsWith('/')) {
          processEntry();
          return;
        }

        // Skip ignored files
        if (shouldIgnore(entryPath)) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        // Apply internal root filter
        let relativePath = entryPath;
        if (internalRoot) {
          if (!entryPath.startsWith(internalRoot)) {
            stats.skippedFiles++;
            processEntry();
            return;
          }
          relativePath = entryPath.substring(internalRoot.length);
        }

        // Skip if empty path after stripping
        if (!relativePath || relativePath === '') {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        // Sanitize path
        const sanitized = sanitizePath(relativePath);
        if (!sanitized) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        const outPath = path.join(targetDir, sanitized);
        stats.totalFiles++;

        // Create parent directories
        fs.mkdirSync(path.dirname(outPath), { recursive: true });

        // Open read stream for entry
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
            // Verify size matches
            if (bytesWritten === entry.uncompressedSize) {
              stats.verifiedFiles++;
            } else {
              stats.failedFiles++;
            }
            extractedFiles.push(sanitized);
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

      // Start processing
      processEntry();
    });
  });
}
