import type { Data as SevenZipData } from 'node-7z';
import type * as yauzl from 'yauzl';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import { openZipFile } from '../extraction/multiVolumeReader';
import { rarErrorCode } from '../extraction/rarExtractor';
import { listRarInWorker } from '../extraction/rarWorker';
import {
  type SevenZipFailure,
  collectSevenZipStderr,
  get7zipPath,
  sevenZipErrorCode,
  sevenZipPassword,
} from '../extraction/sevenZipExtractor';
import type { ArchiveEntry, ArchiveFormat, InstallerError } from '../types';
import { INSTALLER_CONSTANTS } from '../types';
import { listDirectoryEntries } from './folderScanner';

export { detectArchiveFormat, isArchiveFileName as isArchiveFile } from './archiveFormat';

/** Extended node-7z data with encryption info (not in official types) */
interface SevenZipListData extends Partial<SevenZipData> {
  encrypted?: string;
}

/**
 * One row of a 7-Zip listing as an archive entry. 7-Zip also emits rows with no
 * path, which are not files of the archive (Sentry X-DISPATCH-9E, -9F).
 */
export function sevenZipListEntry(data: SevenZipListData): ArchiveEntry | null {
  if (!data.file) return null;
  return {
    path: data.file,
    isDirectory: data.attributes?.startsWith('D') ?? false,
    uncompressedSize: data.size ?? 0,
    compressedSize: data.sizeCompressed ?? 0,
    encrypted: data.encrypted === '+',
  };
}

export interface ArchiveSourceRef {
  format: ArchiveFormat;
  /** The file to read: the archive, its first volume, or the folder. */
  readPath: string;
  /** Every volume of a split archive, in order. */
  volumes?: string[];
}

/**
 * List contents of an archive (or folder) without extracting
 */
export async function listArchiveEntries(
  source: ArchiveSourceRef,
  password?: string
): Promise<Result<ArchiveEntry[], InstallerError>> {
  switch (source.format) {
    case 'zip':
      return listZipEntries(source.readPath, source.volumes);
    case '7z':
      return listSevenZipEntries(source.readPath, password);
    case 'rar':
      return listRarEntries(source.readPath, password);
    case 'folder':
      try {
        return ok(await listDirectoryEntries(source.readPath));
      } catch (e) {
        return err({ code: 'EXTRACTION_FAILED', path: source.readPath, reason: String(e) });
      }
  }
}

/**
 * List ZIP archive entries using yauzl
 */
async function listZipEntries(
  archivePath: string,
  volumes: string[] | undefined
): Promise<Result<ArchiveEntry[], InstallerError>> {
  return new Promise((resolve) => {
    openZipFile(volumes ?? [archivePath], { lazyEntries: false }, (openErr, zipFile) => {
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
  archivePath: string,
  password: string | undefined
): Promise<Result<ArchiveEntry[], InstallerError>> {
  // Dynamic import to avoid issues if 7zip-bin not available
  const node7z = await import('node-7z');
  const list = node7z.default?.list ?? node7z.list;
  const pathTo7zip = await get7zipPath();

  return new Promise((resolve) => {
    const entries: ArchiveEntry[] = [];
    let settled = false;

    try {
      const listStream = list(archivePath, {
        $bin: pathTo7zip,
        password: sevenZipPassword(password),
      });
      const stderr = collectSevenZipStderr(listStream);

      listStream.on('data', (data: SevenZipListData) => {
        const entry = sevenZipListEntry(data);
        if (entry) entries.push(entry);
      });

      listStream.on('end', () => {
        if (settled) return;
        settled = true;
        resolve(ok(entries));
      });

      listStream.on('error', (listErr: SevenZipFailure) => {
        if (settled) return;
        settled = true;
        resolve(
          err(
            sevenZipErrorCode(
              { message: listErr.message, stderr: stderr() || listErr.stderr },
              archivePath,
              password
            )
          )
        );
      });
    } catch (e) {
      resolve(err({ code: 'EXTRACTION_FAILED', path: archivePath, reason: String(e) }));
    }
  });
}

/**
 * List RAR archive entries, on a worker thread so a large archive never stalls the app.
 */
async function listRarEntries(
  archivePath: string,
  password: string | undefined
): Promise<Result<ArchiveEntry[], InstallerError>> {
  try {
    const list = await listRarInWorker(archivePath, password);
    if (list.headerEncrypted && !password) {
      return err({ code: 'PASSWORD_REQUIRED', path: archivePath });
    }
    return ok(
      list.headers.map((header) => ({
        path: header.name,
        isDirectory: header.directory,
        uncompressedSize: header.unpSize,
        compressedSize: header.packSize,
        encrypted: header.encrypted,
      }))
    );
  } catch (e) {
    return err(rarErrorCode(e, archivePath, password));
  }
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
