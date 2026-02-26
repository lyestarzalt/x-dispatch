/**
 * Archive Extraction Module
 * Unified extraction interface for ZIP, 7z, and RAR archives.
 */
import type { Result } from '../../core/types';
import { err } from '../../core/types';
import { detectArchiveFormat } from '../detection/ArchiveScanner';
import type { ArchiveFormat, InstallerError, VerificationStats } from '../types';
import { IGNORE_PATTERNS } from '../types';
import { extractSevenZip } from './sevenZipExtractor';
import { extractZip } from './zipExtractor';

/**
 * Check if a path component should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split(/[/\\]/);
  return parts.some((part) => IGNORE_PATTERNS.includes(part));
}

/**
 * Sanitize path to prevent directory traversal attacks
 */
function sanitizePath(entryPath: string): string | null {
  // Normalize separators
  const normalized = entryPath.replace(/\\/g, '/');

  // Reject absolute paths
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;

  // Reject path traversal
  const parts = normalized.split('/');
  if (parts.some((p) => p === '..')) return null;

  return parts.filter((p) => p !== '').join('/');
}

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
 * Extract RAR archive using node-unrar-js
 */
async function extractRar(options: ExtractOptions): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, password, onProgress } = options;
  const fs = await import('fs');
  const path = await import('path');

  try {
    const { createExtractorFromFile } = await import('node-unrar-js');

    const extractor = await createExtractorFromFile({
      filepath: archivePath,
      targetPath: targetDir,
      password: password,
    });

    const stats: VerificationStats = {
      totalFiles: 0,
      verifiedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
    };
    const extractedFiles: string[] = [];

    // Extract all files
    const extracted = extractor.extract();

    for (const file of extracted.files) {
      if (file.fileHeader.flags.directory) continue;

      let relativePath = file.fileHeader.name;

      // Skip ignored files (macOS/Windows junk)
      if (shouldIgnore(relativePath)) {
        stats.skippedFiles++;
        continue;
      }

      // Apply internal root filter
      if (internalRoot) {
        const normalizedPath = relativePath.replace(/\\/g, '/');
        if (!normalizedPath.startsWith(internalRoot)) {
          stats.skippedFiles++;
          continue;
        }
        relativePath = normalizedPath.substring(internalRoot.length);
      }

      // Sanitize path to prevent directory traversal
      const sanitized = sanitizePath(relativePath);
      if (!sanitized) {
        stats.skippedFiles++;
        continue;
      }

      stats.totalFiles++;

      // Check if file was extracted successfully
      const fullPath = path.join(targetDir, sanitized);
      if (fs.existsSync(fullPath)) {
        const stat = fs.statSync(fullPath);
        onProgress?.(stat.size, sanitized);
        stats.verifiedFiles++;
        extractedFiles.push(sanitized);
      } else {
        stats.failedFiles++;
      }
    }

    return { ok: true, value: { stats, extractedFiles } };
  } catch (e) {
    const errorMsg = String(e);
    if (errorMsg.includes('password') || errorMsg.includes('encrypted')) {
      return err({ code: 'PASSWORD_REQUIRED', path: archivePath });
    }
    return err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: errorMsg });
  }
}

export { extractZip } from './zipExtractor';
export { extractSevenZip } from './sevenZipExtractor';
