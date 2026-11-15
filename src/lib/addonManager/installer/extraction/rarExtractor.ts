/**
 * RAR Extraction Module
 * Extracts RAR4 and RAR5 archives (single or multi-volume); the engine runs on a worker thread.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { InstallerError } from '../types';
import type { ExtractOptions, ExtractResult } from './options';
import { emptyStats, normalizeEntryPath, resolveEntryTarget } from './options';
import { extractRarInWorker, listRarInWorker } from './rarWorker';

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
 * Extract a RAR archive. The engine runs on a worker thread; this side decides
 * which entries to write where and reports progress as they land.
 */
export async function extractRar(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const { archivePath, targetDir, password, onProgress } = options;

  try {
    const list = await listRarInWorker(archivePath, password);
    if (list.headerEncrypted && !password) {
      return err({ code: 'PASSWORD_REQUIRED', path: archivePath });
    }

    const stats = emptyStats();
    const extractedFiles: string[] = [];
    fs.mkdirSync(targetDir, { recursive: true });

    // Entries are written straight to where they belong: the engine is told the
    // final relative name, so there is no "move the add-on folder up" step.
    const targets: Record<string, string> = {};
    const wanted: string[] = [];
    for (const header of list.headers) {
      if (header.directory) continue;
      const sanitized = resolveEntryTarget(header.name, options);
      if (!sanitized) {
        stats.skippedFiles++;
        continue;
      }
      targets[normalizeEntryPath(header.name)] = sanitized;
      wanted.push(header.name);
    }

    if (wanted.length === 0) return ok({ stats, extractedFiles });

    await extractRarInWorker({ archivePath, password, targetDir, wanted, targets }, (name) => {
      const sanitized = targets[normalizeEntryPath(name)];
      if (!sanitized) return;
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
    });

    return ok({ stats, extractedFiles });
  } catch (e) {
    return err(rarErrorCode(e, archivePath, password));
  }
}
