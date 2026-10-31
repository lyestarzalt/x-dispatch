/**
 * ZIP Extraction Module
 * Extracts ZIP files with size verification and progress tracking. Encrypted
 * zips are handed to 7-Zip by the dispatcher; yauzl only reads plain entries.
 */
import * as fs from 'fs';
import * as path from 'path';
import type * as yauzl from 'yauzl';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError } from '../types';
import { openZipFile } from './multiVolumeReader';
import type { ExtractOptions, ExtractResult } from './options';
import { emptyStats, resolveEntryTarget } from './options';

export type { ExtractOptions, ExtractResult } from './options';

/**
 * Extract a ZIP archive
 */
export async function extractZip(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, onProgress } = options;

  return new Promise((resolve) => {
    openZipFile(options.volumes ?? [archivePath], { lazyEntries: true }, (openErr, zipFile) => {
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

      const stats = emptyStats();
      const extractedFiles: string[] = [];
      let settled = false;

      const fail = (error: InstallerError) => {
        if (settled) return;
        settled = true;
        zipFile.close();
        resolve(err(error));
      };

      const processEntry = () => {
        zipFile.readEntry();
      };

      zipFile.on('entry', (entry: yauzl.Entry) => {
        if (settled) return;

        const entryPath = entry.fileName;

        // Skip directories (they're created automatically)
        if (entryPath.endsWith('/')) {
          processEntry();
          return;
        }

        const sanitized = resolveEntryTarget(entryPath, options);
        if (!sanitized) {
          stats.skippedFiles++;
          processEntry();
          return;
        }

        if (entry.isEncrypted()) {
          fail({ code: 'PASSWORD_REQUIRED', path: archivePath });
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
        if (settled) return;
        settled = true;
        zipFile.close();
        resolve(ok({ stats, extractedFiles }));
      });

      zipFile.on('error', (readErr) => {
        fail({ code: 'EXTRACTION_FAILED', path: archivePath, reason: readErr.message });
      });

      // Start processing
      processEntry();
    });
  });
}
