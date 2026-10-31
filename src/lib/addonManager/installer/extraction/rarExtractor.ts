/**
 * RAR Extraction Module
 * Extracts RAR4 and RAR5 archives (single or multi-volume) with node-unrar-js.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError } from '../types';
import type { ExtractOptions, ExtractResult } from './options';
import { emptyStats, normalizeEntryPath, resolveEntryTarget } from './options';

interface UnrarFailure {
  reason?: string;
  message?: string;
}

/** The installer's code for an unrar failure, given whether a password was tried. */
export function rarErrorCode(
  e: unknown,
  archivePath: string,
  password: string | undefined
): InstallerError {
  const failure = e as UnrarFailure | null;
  const reason = failure?.reason ?? '';
  if (reason === 'ERAR_MISSING_PASSWORD') {
    return password
      ? { code: 'INVALID_PASSWORD', path: archivePath }
      : { code: 'PASSWORD_REQUIRED', path: archivePath };
  }
  if (reason === 'ERAR_BAD_PASSWORD' || (reason === 'ERAR_BAD_DATA' && password)) {
    return { code: 'INVALID_PASSWORD', path: archivePath };
  }
  const message = failure?.message ?? String(e);
  if (/password/i.test(message)) {
    return password
      ? { code: 'INVALID_PASSWORD', path: archivePath }
      : { code: 'PASSWORD_REQUIRED', path: archivePath };
  }
  return { code: 'EXTRACTION_FAILED', path: archivePath, reason: message };
}

/**
 * Extract a RAR archive
 */
export async function extractRar(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, password, onProgress } = options;

  try {
    const { createExtractorFromFile } = await import('node-unrar-js');

    // Entries are written straight to where they belong: the engine is told the
    // final relative name, so there is no "move the add-on folder up" step.
    const targets = new Map<string, string>();
    const extractor = await createExtractorFromFile({
      filepath: archivePath,
      targetPath: targetDir,
      password,
      filenameTransform: (name) => targets.get(normalizeEntryPath(name)) ?? name,
    });

    const stats = emptyStats();
    const extractedFiles: string[] = [];

    fs.mkdirSync(targetDir, { recursive: true });

    const wanted: string[] = [];
    const list = extractor.getFileList();
    if (list.arcHeader.flags.headerEncrypted && !password) {
      return err({ code: 'PASSWORD_REQUIRED', path: archivePath });
    }
    for (const header of list.fileHeaders) {
      if (header.flags.directory) continue;
      const sanitized = resolveEntryTarget(header.name, options);
      if (!sanitized) {
        stats.skippedFiles++;
        continue;
      }
      targets.set(normalizeEntryPath(header.name), sanitized);
      wanted.push(header.name);
    }

    if (wanted.length === 0) return ok({ stats, extractedFiles });

    // The generator drives the extraction; it must be walked to the end.
    const extracted = extractor.extract({ files: wanted });
    for (const file of extracted.files) {
      const sanitized = targets.get(normalizeEntryPath(file.fileHeader.name));
      if (!sanitized) continue;
      stats.totalFiles++;
      const fullPath = path.join(targetDir, sanitized);
      try {
        const stat = fs.statSync(fullPath);
        onProgress?.(stat.size, sanitized);
        stats.verifiedFiles++;
        extractedFiles.push(sanitized);
      } catch {
        stats.failedFiles++;
      }
    }

    return ok({ stats, extractedFiles });
  } catch (e) {
    return err(rarErrorCode(e, archivePath, password));
  }
}
