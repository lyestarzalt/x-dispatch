/**
 * Archive Extraction Module
 * Unified extraction interface for ZIP, 7z, and RAR archives.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import { detectArchiveFormat } from '../detection/ArchiveScanner';
import type { ArchiveFormat, InstallerError, VerificationStats } from '../types';
import { listFilesRecursive, moveTree, normalizeInternalRoot, pruneIgnored } from './entryPaths';
import { extractSevenZip } from './sevenZipExtractor';
import { extractZip } from './zipExtractor';

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
 * Extract an archive to a target directory
 */
export async function extractArchive(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const format = detectArchiveFormat(options.archivePath);

  if (!format) {
    return err({ code: 'UNSUPPORTED_FORMAT', path: options.archivePath });
  }

  return extractByFormat(format, options);
}

/**
 * Extract archive by format
 */
async function extractByFormat(
  format: ArchiveFormat,
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  switch (format) {
    case 'zip':
      return extractZip(options);

    case '7z':
      return extractSevenZip(options);

    case 'rar':
      return extractRar(options);

    default:
      return err({ code: 'UNSUPPORTED_FORMAT', path: options.archivePath });
  }
}

/**
 * Extract a RAR archive using node-unrar-js.
 *
 * The library writes the files itself, so the archive is unpacked into a
 * staging folder and only the requested internal root is moved into the target.
 */
async function extractRar(options: ExtractOptions): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, password, onProgress } = options;

  const staging = path.join(targetDir, `.xdispatch-staging-${process.pid}-${Date.now()}`);

  try {
    const { createExtractorFromFile } = await import('node-unrar-js');

    fs.mkdirSync(staging, { recursive: true });

    const extractor = await createExtractorFromFile({
      filepath: archivePath,
      targetPath: staging,
      password: password,
    });

    const extracted = extractor.extract();
    for (const file of extracted.files) {
      if (!file.fileHeader.flags.directory) {
        onProgress?.(file.fileHeader.unpSize ?? 0, file.fileHeader.name);
      }
    }

    const skippedFiles = pruneIgnored(staging);

    const root = internalRoot ? normalizeInternalRoot(internalRoot).replace(/\/$/, '') : '';
    const sourceDir = root ? path.join(staging, ...root.split('/')) : staging;

    if (!fs.existsSync(sourceDir)) {
      fs.rmSync(staging, { recursive: true, force: true });
      return err({
        code: 'EXTRACTION_FAILED',
        path: archivePath,
        reason: `Archive has no folder "${root}"`,
      });
    }

    const extractedFiles = listFilesRecursive(sourceDir);
    const { moved, failed } = moveTree(sourceDir, targetDir);
    fs.rmSync(staging, { recursive: true, force: true });

    const stats: VerificationStats = {
      totalFiles: extractedFiles.length,
      verifiedFiles: moved,
      failedFiles: failed + Math.max(0, extractedFiles.length - moved - failed),
      skippedFiles,
    };

    return ok({ stats, extractedFiles });
  } catch (e) {
    fs.rmSync(staging, { recursive: true, force: true });
    const errorMsg = String(e);
    if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
      return err({ code: 'PASSWORD_REQUIRED', path: archivePath });
    }
    return err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: errorMsg });
  }
}

export { extractZip } from './zipExtractor';
export { extractSevenZip } from './sevenZipExtractor';
