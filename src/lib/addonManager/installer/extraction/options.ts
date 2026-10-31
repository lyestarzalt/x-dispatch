/**
 * What every extractor takes and returns, and the path rules they all apply:
 * junk files are skipped, the add-on's folder inside the archive is stripped,
 * and nothing may escape the target folder.
 */
import type { VerificationStats } from '../types';
import { IGNORE_PATTERNS } from '../types';

export interface ExtractOptions {
  /** The archive file, or a folder when the source is a dropped directory. */
  archivePath: string;
  /** Target directory */
  targetDir: string;
  /** Internal root to strip from paths (e.g., "MyAddon/") */
  internalRoot?: string;
  /** Password for encrypted archives */
  password?: string;
  /** Every volume of a split archive, in order; `archivePath` is the first. */
  volumes?: string[];
  /** Extract only these entries (archive paths, as listed). */
  only?: string[];
  /** Progress callback: (bytesWritten, currentFile) */
  onProgress?: (bytes: number, file: string) => void;
}

export interface ExtractResult {
  stats: VerificationStats;
  extractedFiles: string[];
}

export function emptyStats(): VerificationStats {
  return { totalFiles: 0, verifiedFiles: 0, failedFiles: 0, skippedFiles: 0 };
}

/** Archive paths use `/`; engines on Windows may report `\`. */
export function normalizeEntryPath(entryPath: string): string {
  return entryPath.replace(/\\/g, '/');
}

/**
 * Check if a path component should be ignored
 */
export function shouldIgnore(filePath: string): boolean {
  const parts = normalizeEntryPath(filePath).split('/');
  return parts.some((part) => IGNORE_PATTERNS.includes(part));
}

/**
 * Sanitize path to prevent directory traversal attacks
 */
export function sanitizePath(entryPath: string): string | null {
  const normalized = normalizeEntryPath(entryPath);

  // Reject absolute paths
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;

  // Reject path traversal
  const parts = normalized.split('/');
  if (parts.some((p) => p === '..')) return null;

  return parts.filter((p) => p !== '').join('/');
}

/**
 * Where an archive entry lands relative to the target, or null to skip it:
 * junk, outside the add-on's folder, not in `only`, or an unsafe path.
 */
export function resolveEntryTarget(
  entryPath: string,
  options: Pick<ExtractOptions, 'internalRoot' | 'only'>
): string | null {
  const normalized = normalizeEntryPath(entryPath);
  if (shouldIgnore(normalized)) return null;
  if (options.only && !options.only.some((o) => normalizeEntryPath(o) === normalized)) return null;

  let relative = normalized;
  if (options.internalRoot) {
    if (!normalized.startsWith(options.internalRoot)) return null;
    relative = normalized.substring(options.internalRoot.length);
  }
  if (!relative) return null;

  return sanitizePath(relative);
}
