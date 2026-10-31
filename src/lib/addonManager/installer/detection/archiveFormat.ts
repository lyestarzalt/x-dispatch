/**
 * What was dropped: which archive engine opens it, and which file to hand that engine.
 *
 * The format comes from the file's first bytes, so a mislabelled download still
 * opens. Split downloads (`.7z.001`, `.part1.rar`, `.r00`) are resolved to their
 * first volume and checked for gaps, so the engine never stops halfway with a
 * cryptic read error.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Result } from '../../core/types';
import { err, ok } from '../../core/types';
import type { ArchiveFormat, InstallerError } from '../types';

const ZIP_SIGNATURES = [
  [0x50, 0x4b, 0x03, 0x04],
  [0x50, 0x4b, 0x05, 0x06],
  [0x50, 0x4b, 0x07, 0x08],
];
const SEVEN_ZIP_SIGNATURE = [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c];
const RAR_SIGNATURE = [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07];

function startsWithBytes(header: Buffer, bytes: number[]): boolean {
  if (header.length < bytes.length) return false;
  return bytes.every((b, i) => header[i] === b);
}

/** The archive format from the file's magic bytes; null when unreadable or unknown. */
export function sniffArchiveFormat(filePath: string): ArchiveFormat | null {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    const read = fs.readSync(fd, header, 0, 8, 0);
    const bytes = header.subarray(0, read);
    if (ZIP_SIGNATURES.some((sig) => startsWithBytes(bytes, sig))) return 'zip';
    if (startsWithBytes(bytes, SEVEN_ZIP_SIGNATURE)) return '7z';
    if (startsWithBytes(bytes, RAR_SIGNATURE)) return 'rar';
    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}

function formatFromExtension(filePath: string): ArchiveFormat | null {
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

export type SplitVolumeKind = 'numbered' | 'rar-part' | 'rar-r' | 'zip-z';

export interface SplitVolume {
  kind: SplitVolumeKind;
  /** Everything before the number: `pack.7z.`, `pack.part`, `pack` (for `.r00`/`.z01`). */
  prefix: string;
  index: number;
  width: number;
}

/** Recognise `x.7z.001`, `x.zip.002`, `x.003`, `x.part1.rar`, `x.r00`, `x.z01`. */
export function parseSplitVolume(fileName: string): SplitVolume | null {
  let m = /^(.*\.part)(\d+)\.rar$/i.exec(fileName);
  if (m && m[1] && m[2]) {
    return { kind: 'rar-part', prefix: m[1], index: Number(m[2]), width: m[2].length };
  }
  m = /^(.+)\.r(\d{2,})$/i.exec(fileName);
  if (m && m[1] && m[2]) {
    return { kind: 'rar-r', prefix: m[1], index: Number(m[2]), width: m[2].length };
  }
  m = /^(.+)\.z(\d{2,})$/i.exec(fileName);
  if (m && m[1] && m[2]) {
    return { kind: 'zip-z', prefix: m[1], index: Number(m[2]), width: m[2].length };
  }
  m = /^(.+\.)(\d{3,})$/.exec(fileName);
  if (m && m[1] && m[2]) {
    return { kind: 'numbered', prefix: m[1], index: Number(m[2]), width: m[2].length };
  }
  return null;
}

function volumeName(volume: SplitVolume, index: number): string {
  const digits = String(index).padStart(volume.width, '0');
  switch (volume.kind) {
    case 'rar-part':
      return `${volume.prefix}${digits}.rar`;
    case 'rar-r':
      return `${volume.prefix}.r${digits}`;
    case 'zip-z':
      return `${volume.prefix}.z${digits}`;
    case 'numbered':
      return `${volume.prefix}${digits}`;
  }
}

/** Is this name an archive the installer can open: a plain one, or the first volume of a set. */
export function isArchiveFileName(filePath: string): boolean {
  const name = path.basename(filePath);
  const volume = parseSplitVolume(name);
  // A `.rNN` set starts at the plain `.rar`; `.z01` sets are not readable at all
  if (volume)
    return (volume.kind === 'numbered' || volume.kind === 'rar-part') && volume.index <= 1;
  return formatFromExtension(name) !== null;
}

/**
 * The format of a single file, bytes first and extension second. Volume sets go
 * through `prepareArchiveSource`, which knows which file to read.
 */
export function detectArchiveFormat(filePath: string): ArchiveFormat | null {
  return sniffArchiveFormat(filePath) ?? formatFromExtension(filePath);
}

export interface ArchiveSource {
  format: ArchiveFormat;
  /** The file (or folder) to hand to the engine. */
  readPath: string;
  /** Every volume of a split set, in order; absent for a single file. */
  volumes?: string[];
  /** Removes any temporary file this source needed. */
  cleanup: () => Promise<void>;
}

const noCleanup = async () => {};

function findSibling(dir: string, name: string): string | null {
  const direct = path.join(dir, name);
  if (fs.existsSync(direct)) return direct;
  const lower = name.toLowerCase();
  try {
    for (const entry of fs.readdirSync(dir)) {
      if (entry.toLowerCase() === lower) return path.join(dir, entry);
    }
  } catch {
    // unreadable folder: treated as missing
  }
  return null;
}

/** Index of `name` within the same set as `volume`, or null when it is another file. */
function volumeIndex(volume: SplitVolume, name: string): number | null {
  const parsed = parseSplitVolume(name);
  if (!parsed || parsed.kind !== volume.kind) return null;
  if (parsed.prefix.toLowerCase() !== volume.prefix.toLowerCase()) return null;
  return parsed.index;
}

/** All volumes of the set `volume` belongs to, in order, or the first missing name. */
function collectVolumes(
  dir: string,
  volume: SplitVolume
): { volumes: string[] } | { missing: string } {
  const byIndex = new Map<number, string>();
  try {
    for (const entry of fs.readdirSync(dir)) {
      const index = volumeIndex(volume, entry);
      if (index !== null && !byIndex.has(index)) byIndex.set(index, path.join(dir, entry));
    }
  } catch {
    // unreadable folder: only the dropped file is known
  }

  const volumes: string[] = [];
  // RAR `.rNN` sets start at the plain `.rar`, then `.r00`, `.r01`, ...
  if (volume.kind === 'rar-r') {
    const head = findSibling(dir, `${volume.prefix}.rar`);
    if (!head) return { missing: `${volume.prefix}.rar` };
    volumes.push(head);
  }
  const first = volume.kind === 'rar-r' ? 0 : 1;
  const last = Math.max(volume.index, ...byIndex.keys());
  for (let index = first; index <= last; index++) {
    const found = byIndex.get(index);
    if (!found) return { missing: volumeName(volume, index) };
    volumes.push(found);
  }
  return { volumes };
}

/** Join volumes into one file, for the one engine that cannot read them apart (7-Zip on a zip). */
export async function concatenateVolumes(volumes: string[], readPath: string): Promise<void> {
  const out = fs.createWriteStream(readPath);
  const failed = new Promise<never>((_, reject) => out.on('error', reject));
  try {
    for (const volume of volumes) {
      await Promise.race([
        failed,
        new Promise<void>((resolve, reject) => {
          const input = fs.createReadStream(volume);
          input.on('error', reject);
          input.on('end', resolve);
          input.pipe(out, { end: false });
        }),
      ]);
    }
    await Promise.race([failed, new Promise<void>((resolve) => out.end(resolve))]);
  } catch (e) {
    out.destroy();
    throw e;
  }
}

/**
 * Work out how to read what was dropped. A folder is read in place; a split set is
 * resolved to its first volume, with every volume listed: the 7z and RAR engines
 * chain them themselves, and the zip engine reads them through one seekable view.
 */
export async function prepareArchiveSource(
  filePath: string
): Promise<Result<ArchiveSource, InstallerError>> {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return err({ code: 'NOT_ARCHIVE', path: filePath, folder: false });
  }
  if (stat.isDirectory()) {
    return ok({ format: 'folder', readPath: filePath, cleanup: noCleanup });
  }

  const dir = path.dirname(filePath);
  const volume = parseSplitVolume(path.basename(filePath));
  if (!volume) {
    const format = detectArchiveFormat(filePath);
    if (!format) return err({ code: 'NOT_ARCHIVE', path: filePath, folder: false });
    return ok({ format, readPath: filePath, cleanup: noCleanup });
  }

  if (volume.kind === 'zip-z') {
    // PKZIP spanned sets keep offsets per disk; no engine we ship reads them.
    return err({ code: 'UNSUPPORTED_FORMAT', path: filePath });
  }

  const collected = collectVolumes(dir, volume);
  if ('missing' in collected) {
    return err({ code: 'MISSING_VOLUME', path: filePath, missing: collected.missing });
  }
  const { volumes } = collected;
  const first = volumes[0];
  if (!first) return err({ code: 'NOT_ARCHIVE', path: filePath, folder: false });

  const format = sniffArchiveFormat(first) ?? formatFromExtension(volume.prefix.replace(/\.$/, ''));
  if (!format || format === 'folder') {
    return err({ code: 'NOT_ARCHIVE', path: filePath, folder: false });
  }

  return ok({ format, readPath: first, volumes, cleanup: noCleanup });
}
