/**
 * Archive Extraction Module
 * Unified extraction interface for ZIP, 7z, RAR archives and dropped folders.
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import { concatenateVolumes } from '../detection/archiveFormat';
import type { ArchiveFormat, InstallerError } from '../types';
import { extractFolder } from './folderExtractor';
import type { ExtractOptions, ExtractResult } from './options';
import { sanitizePath } from './options';
import { extractRar } from './rarExtractor';
import { extractSevenZip } from './sevenZipExtractor';
import { extractZip } from './zipExtractor';

export type { ExtractOptions, ExtractResult } from './options';

/**
 * Extract an archive (or copy a folder) to a target directory
 */
export async function extractArchive(
  format: ArchiveFormat,
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  switch (format) {
    case 'zip':
      // yauzl reads plain zips; 7-Zip knows ZipCrypto and AES
      if (!options.password) return extractZip(options);
      // 7-Zip cannot read a byte-split zip by its volumes: join them for it
      if (options.volumes && options.volumes.length > 1) return withJoinedVolumes(options);
      return extractSevenZip(options);
    case '7z':
      return extractSevenZip(options);
    case 'rar':
      return extractRar(options);
    case 'folder':
      return extractFolder(options);
    default:
      return err({ code: 'UNSUPPORTED_FORMAT', path: options.archivePath });
  }
}

async function withJoinedVolumes(
  options: ExtractOptions
): Promise<Result<ExtractResult, InstallerError>> {
  const joined = path.join(os.tmpdir(), `xdispatch_joined_${crypto.randomUUID()}.zip`);
  try {
    await concatenateVolumes(options.volumes ?? [], joined);
    return await extractSevenZip({ ...options, archivePath: joined, volumes: undefined });
  } catch (e) {
    return err({ code: 'EXTRACTION_FAILED', path: options.archivePath, reason: String(e) });
  } finally {
    await fs.promises.rm(joined, { force: true }).catch(() => {});
  }
}

/** What `readArchiveEntry` and `probeArchiveEntry` need to know about an archive. */
export interface ArchiveRef {
  format: ArchiveFormat;
  readPath: string;
  volumes?: string[];
}

/**
 * Extract one entry to a temporary folder and throw it away: proves the archive
 * opens and the password fits without reading anything into memory.
 */
export async function probeArchiveEntry(
  source: ArchiveRef,
  entryPath: string,
  password?: string
): Promise<Result<void, InstallerError>> {
  const tempDir = path.join(os.tmpdir(), `xdispatch_probe_${crypto.randomUUID()}`);
  try {
    const result = await extractArchive(source.format, {
      archivePath: source.readPath,
      volumes: source.volumes,
      targetDir: tempDir,
      only: [entryPath],
      password,
    });
    if (!result.ok) return result;
    if (!result.value.extractedFiles[0]) {
      return err({
        code: 'EXTRACTION_FAILED',
        path: source.readPath,
        reason: `${entryPath} not found`,
      });
    }
    return ok(undefined);
  } catch (e) {
    return err({ code: 'EXTRACTION_FAILED', path: source.readPath, reason: String(e) });
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/** Largest file read into memory during analysis (cycle.json, version files). */
const MAX_INLINE_READ = 256 * 1024;

/**
 * Read one entry of an archive into memory, by extracting it to a temporary folder.
 * Used during analysis for small metadata files, and to check a password.
 */
export async function readArchiveEntry(
  source: ArchiveRef,
  entryPath: string,
  password?: string,
  maxBytes: number = MAX_INLINE_READ
): Promise<Result<Buffer, InstallerError>> {
  const { format, readPath: archivePath } = source;
  if (format === 'folder') {
    const sanitized = sanitizePath(entryPath);
    if (!sanitized) return err({ code: 'PATH_TRAVERSAL', path: entryPath });
    try {
      const file = path.join(archivePath, ...sanitized.split('/'));
      const stat = await fs.promises.stat(file);
      if (stat.size > maxBytes) {
        return err({ code: 'SIZE_EXCEEDED', size: stat.size, limit: maxBytes });
      }
      return ok(await fs.promises.readFile(file));
    } catch (e) {
      return err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) });
    }
  }

  const tempDir = path.join(os.tmpdir(), `xdispatch_read_${crypto.randomUUID()}`);
  try {
    const result = await extractArchive(format, {
      archivePath,
      volumes: source.volumes,
      targetDir: tempDir,
      only: [entryPath],
      password,
    });
    if (!result.ok) return result;
    const written = result.value.extractedFiles[0];
    if (!written) {
      return err({
        code: 'EXTRACTION_FAILED',
        path: archivePath,
        reason: `${entryPath} not found`,
      });
    }
    const file = path.join(tempDir, written);
    const stat = await fs.promises.stat(file);
    if (stat.size > maxBytes) {
      return err({ code: 'SIZE_EXCEEDED', size: stat.size, limit: maxBytes });
    }
    return ok(await fs.promises.readFile(file));
  } catch (e) {
    return err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) });
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export { extractZip } from './zipExtractor';
export { extractSevenZip } from './sevenZipExtractor';
export { extractRar } from './rarExtractor';
export { extractFolder } from './folderExtractor';
