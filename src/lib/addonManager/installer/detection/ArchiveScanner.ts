import type { Data as SevenZipData } from 'node-7z';
import * as path from 'path';
import * as yauzl from 'yauzl';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { ArchiveEntry, ArchiveFormat, InstallerError } from '../types';
import { INSTALLER_CONSTANTS } from '../types';

/** Extended node-7z data with encryption info (not in official types) */
interface SevenZipListData extends SevenZipData {
  encrypted?: string;
}

/**
 * Detect archive format from file extension
 */
export function detectArchiveFormat(filePath: string): ArchiveFormat | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.zip':
      return 'zip';
    case '.7z':
      return '7z';
    case '.rar':
      return 'rar';
    default:
      return null;
  }
}

/**
 * Check if a file is a supported archive
 */
export function isArchiveFile(filePath: string): boolean {
  return detectArchiveFormat(filePath) !== null;
}

/**
 * List contents of an archive without extracting
 */
export async function listArchiveEntries(
  archivePath: string
): Promise<Result<ArchiveEntry[], InstallerError>> {
  const format = detectArchiveFormat(archivePath);
  if (!format) {
    return err({ code: 'UNSUPPORTED_FORMAT', path: archivePath });
  }

  switch (format) {
    case 'zip':
      return listZipEntries(archivePath);
    case '7z':
      return listSevenZipEntries(archivePath);
    case 'rar':
      return listRarEntries(archivePath);
  }
}

/**
 * List ZIP archive entries using yauzl
 */
async function listZipEntries(
  archivePath: string
): Promise<Result<ArchiveEntry[], InstallerError>> {
  return new Promise((resolve) => {
    yauzl.open(archivePath, { lazyEntries: false }, (openErr, zipFile) => {
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

      const entries: ArchiveEntry[] = [];

      zipFile.on('entry', (entry: yauzl.Entry) => {
        entries.push({
          path: entry.fileName,
          isDirectory: entry.fileName.endsWith('/'),
          uncompressedSize: entry.uncompressedSize,
          compressedSize: entry.compressedSize,
          crc32: entry.crc32,
          // Bit 0 (0x1) of generalPurposeBitFlag indicates encryption per ZIP spec
          encrypted: (entry.generalPurposeBitFlag & 0x1) !== 0,
        });
      });

      zipFile.on('end', () => {
        zipFile.close();
        resolve(ok(entries));
      });

      zipFile.on('error', (readErr) => {
        zipFile.close();
        resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: readErr.message }));
      });
    });
  });
}

/**
 * List 7z archive entries using node-7z
 */
async function listSevenZipEntries(
  archivePath: string
): Promise<Result<ArchiveEntry[], InstallerError>> {
  // Dynamic import to avoid issues if 7zip-bin not available
  const { list } = await import('node-7z');
  const pathTo7zip = await get7zipPath();

  return new Promise((resolve) => {
    const entries: ArchiveEntry[] = [];

    try {
      const listStream = list(archivePath, { $bin: pathTo7zip });

      listStream.on('data', (data: SevenZipListData) => {
        entries.push({
          path: data.file,
          isDirectory: data.attributes?.startsWith('D') ?? false,
          uncompressedSize: data.size || 0,
          compressedSize: data.sizeCompressed || 0,
          encrypted: data.encrypted === '+',
        });
      });

      listStream.on('end', () => {
        resolve(ok(entries));
      });

      listStream.on('error', (listErr: Error) => {
        resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(listErr) }));
      });
    } catch (e) {
      resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) }));
    }
  });
}

/**
 * List RAR archive entries using node-unrar-js
 */
async function listRarEntries(
  archivePath: string
): Promise<Result<ArchiveEntry[], InstallerError>> {
  const { createExtractorFromFile } = await import('node-unrar-js');

  try {
    const extractor = await createExtractorFromFile({ filepath: archivePath });
    const fileList = extractor.getFileList();

    if (fileList.arcHeader.flags.headerEncrypted) {
      return err({ code: 'PASSWORD_REQUIRED', path: archivePath });
    }

    const entries: ArchiveEntry[] = [];
    for (const header of fileList.fileHeaders) {
      entries.push({
        path: header.name,
        isDirectory: header.flags.directory,
        uncompressedSize: header.unpSize,
        compressedSize: header.packSize,
        encrypted: header.flags.encrypted,
      });
    }

    return ok(entries);
  } catch (e) {
    return err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) });
  }
}

/**
 * Get path to bundled 7zip binary
 */
async function get7zipPath(): Promise<string> {
  const sevenZipBin = await import('7zip-bin');
  return sevenZipBin.path7za;
}

/**
 * Calculate total uncompressed size from entries
 */
export function calculateTotalSize(entries: ArchiveEntry[]): number {
  return entries.reduce((sum, e) => sum + e.uncompressedSize, 0);
}

/**
 * Check for suspicious compression ratio
 */
export function checkCompressionRatio(
  compressedSize: number,
  uncompressedSize: number,
  maxRatio: number = INSTALLER_CONSTANTS.MAX_COMPRESSION_RATIO
): { suspicious: boolean; ratio: number } {
  if (compressedSize === 0) return { suspicious: false, ratio: 0 };
  const ratio = uncompressedSize / compressedSize;
  return { suspicious: ratio > maxRatio, ratio };
}
