/**
 * 7-Zip Extraction Module
 * Extracts 7z archives using node-7z with progress tracking.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError, VerificationStats } from '../types';
import { IGNORE_PATTERNS } from '../types';
import type { ExtractOptions, ExtractResult } from './zipExtractor';

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
  if (path.isAbsolute(normalized)) return null;

  // Reject path traversal
  const parts = normalized.split('/');
  if (parts.some((p) => p === '..')) return null;

  return parts.filter((p) => p !== '').join('/');
}

/**
 * Get path to bundled 7zip binary
 */
async function get7zipPath(): Promise<string> {
  const sevenZipBin = await import('7zip-bin');
  return sevenZipBin.path7za;
}

/**
 * Extract a 7z archive
 */
export async function extractSevenZip(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, internalRoot, password, onProgress } = options;

  const { extractFull } = await import('node-7z');
  const pathTo7zip = await get7zipPath();

  return new Promise((resolve) => {
    const stats: VerificationStats = {
      totalFiles: 0,
      verifiedFiles: 0,
      failedFiles: 0,
      skippedFiles: 0,
    };
    const extractedFiles: string[] = [];

    // Create target directory
    fs.mkdirSync(targetDir, { recursive: true });

    try {
      const extractStream = extractFull(archivePath, targetDir, {
        $bin: pathTo7zip,
        recursive: true,
        password: password,
      });

      extractStream.on('data', (data: { file: string; status?: string }) => {
        const filePath = data.file;
        if (!filePath) return;

        // Skip ignored files
        if (shouldIgnore(filePath)) {
          stats.skippedFiles++;
          return;
        }

        // Apply internal root filter
        let relativePath = filePath;
        if (internalRoot) {
          const normalizedPath = filePath.replace(/\\/g, '/');
          if (!normalizedPath.startsWith(internalRoot)) {
            stats.skippedFiles++;
            return;
          }
          relativePath = normalizedPath.substring(internalRoot.length);
        }

        // Sanitize
        const sanitized = sanitizePath(relativePath);
        if (!sanitized) {
          stats.skippedFiles++;
          return;
        }

        stats.totalFiles++;
        extractedFiles.push(sanitized);

        // Get file size for progress
        const fullPath = path.join(targetDir, sanitized);
        try {
          const stat = fs.statSync(fullPath);
          onProgress?.(stat.size, sanitized);
          stats.verifiedFiles++;
        } catch {
          stats.failedFiles++;
        }
      });

      extractStream.on('end', () => {
        // If internalRoot is specified, we need to move files from the extracted subfolder
        if (internalRoot) {
          const sourceDir = path.join(targetDir, internalRoot.replace(/\/$/, ''));
          if (fs.existsSync(sourceDir)) {
            // Move contents up
            moveContentsUp(sourceDir, targetDir);
          }
        }

        resolve(ok({ stats, extractedFiles }));
      });

      extractStream.on('error', (extractErr: Error) => {
        if (extractErr.message.includes('password')) {
          resolve(err({ code: 'PASSWORD_REQUIRED', path: archivePath }));
        } else {
          resolve(
            err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: extractErr.message })
          );
        }
      });
    } catch (e) {
      resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) }));
    }
  });
}

/**
 * Move contents from a subdirectory up to the parent
 */
function moveContentsUp(sourceDir: string, targetDir: string): void {
  const entries = fs.readdirSync(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(sourceDir, entry.name);
    const dstPath = path.join(targetDir, entry.name);

    if (srcPath === targetDir) continue; // Skip if same as target

    if (entry.isDirectory()) {
      // Recursively copy directory
      fs.cpSync(srcPath, dstPath, { recursive: true });
    } else {
      // Copy file
      fs.copyFileSync(srcPath, dstPath);
    }
  }

  // Remove the source directory
  fs.rmSync(sourceDir, { recursive: true, force: true });
}
