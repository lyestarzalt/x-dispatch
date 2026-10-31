/**
 * Folder "extraction": a dropped directory is copied with the same path rules
 * an archive gets, so a folder and its zip install identically.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import { listDirectoryEntries } from '../detection/folderScanner';
import type { InstallerError } from '../types';
import type { ExtractOptions, ExtractResult } from './options';
import { emptyStats, resolveEntryTarget } from './options';

export async function extractFolder(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, onProgress } = options;
  const stats = emptyStats();
  const extractedFiles: string[] = [];

  try {
    const entries = await listDirectoryEntries(archivePath);
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const sanitized = resolveEntryTarget(entry.path, options);
      if (!sanitized) {
        stats.skippedFiles++;
        continue;
      }
      stats.totalFiles++;
      const source = path.join(archivePath, ...entry.path.split('/'));
      const outPath = path.join(targetDir, sanitized);
      try {
        await fs.promises.mkdir(path.dirname(outPath), { recursive: true });
        await fs.promises.copyFile(source, outPath);
        stats.verifiedFiles++;
        extractedFiles.push(sanitized);
        onProgress?.(entry.uncompressedSize, sanitized);
      } catch {
        stats.failedFiles++;
      }
    }
    return ok({ stats, extractedFiles });
  } catch (e) {
    return err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) });
  }
}
