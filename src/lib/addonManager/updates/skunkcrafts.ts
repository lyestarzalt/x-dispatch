/**
 * SkunkCrafts updater protocol.
 *
 * An addon that ships `skunkcrafts_updater.cfg` points at a folder on the
 * author's server holding the same cfg plus three manifests:
 *
 *   skunkcrafts_updater_whitelist.txt   path|crc32|size, one per file
 *   skunkcrafts_updater_blacklist.txt   files to delete from the install
 *   skunkcrafts_updater_notshared.txt   files fetched only when missing
 *
 * The update is a diff: a file is fetched when its CRC32 does not match, which
 * is what keeps a 4 GB aircraft update down to the few megabytes that changed.
 */
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as zlib from 'zlib';
import type { Result } from '../core/types';
import { err, ok } from '../core/types';
import { sanitizeEntryPath } from '../installer/extraction/entryPaths';

const CFG_FILE = 'skunkcrafts_updater.cfg';
const WHITELIST_FILE = 'skunkcrafts_updater_whitelist.txt';
const BLACKLIST_FILE = 'skunkcrafts_updater_blacklist.txt';
const NOTSHARED_FILE = 'skunkcrafts_updater_notshared.txt';

const FETCH_TIMEOUT_MS = 30_000;
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 512 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024 * 1024;
const DOWNLOAD_CONCURRENCY = 4;

export interface ManifestEntry {
  path: string;
  crc32: number;
  size: number;
}

export interface SkunkCraftsManifest {
  version: string;
  baseUrl: string;
  files: ManifestEntry[];
  blacklist: string[];
  once: string[];
}

export interface UpdatePlan {
  version: string;
  download: ManifestEntry[];
  remove: string[];
  unchangedCount: number;
  downloadBytes: number;
}

export type UpdateError =
  | { code: 'INVALID_URL'; url: string }
  | { code: 'FETCH_FAILED'; url: string; status: number }
  | { code: 'MANIFEST_INVALID'; reason: string }
  | { code: 'SIZE_EXCEEDED'; size: number; limit: number }
  | { code: 'VERIFY_FAILED'; path: string }
  | { code: 'WRITE_FAILED'; path: string; reason: string }
  | { code: 'CANCELLED' };

export function getUpdateErrorMessage(error: UpdateError): string {
  switch (error.code) {
    case 'INVALID_URL':
      return `Update server rejected: ${error.url}`;
    case 'FETCH_FAILED':
      return `Update server returned ${error.status}`;
    case 'MANIFEST_INVALID':
      return `Update manifest is unusable: ${error.reason}`;
    case 'SIZE_EXCEEDED':
      return `Update is too large: ${(error.size / 1024 / 1024 / 1024).toFixed(1)} GB`;
    case 'VERIFY_FAILED':
      return `Downloaded file did not match the manifest: ${error.path}`;
    case 'WRITE_FAILED':
      return `Could not write ${error.path}: ${error.reason}`;
    case 'CANCELLED':
      return 'Update cancelled';
  }
}

/**
 * CRC32 as the manifests use it. Node exposes one; the table is the fallback
 * for runtimes that do not.
 */
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let value = i;
    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  const native = (zlib as { crc32?: (data: Buffer) => number }).crc32;
  if (typeof native === 'function') return native(data) >>> 0;

  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Only public https servers are contacted, so a crafted cfg cannot turn the
 * updater into a probe of the user's own network.
 */
export function isAllowedUpdateUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    if (url.protocol !== 'https:') return false;

    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host === '::1' || host.endsWith('.local')) return false;
    if (/^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host)) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (/^169\.254\./.test(host)) return false;

    return true;
  } catch {
    return false;
  }
}

async function fetchText(url: string, limit: number): Promise<Result<string, UpdateError>> {
  if (!isAllowedUpdateUrl(url)) return err({ code: 'INVALID_URL', url });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return err({ code: 'FETCH_FAILED', url, status: response.status });

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > limit) {
      return err({ code: 'SIZE_EXCEEDED', size: buffer.length, limit });
    }
    return ok(buffer.toString('utf-8'));
  } catch {
    return err({ code: 'FETCH_FAILED', url, status: 0 });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Lines are `relative/path|crc32|size`. Anything unparseable is skipped rather
 * than failing the whole update, which is how the official updater behaves.
 */
export function parseWhitelist(text: string): ManifestEntry[] {
  const entries: ManifestEntry[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const [rawPath, rawCrc, rawSize] = trimmed.split('|');
    if (!rawPath || rawCrc === undefined || rawSize === undefined) continue;

    const safePath = sanitizeEntryPath(rawPath);
    if (!safePath) continue;

    const crc = Number.parseInt(rawCrc.trim(), 10);
    const size = Number.parseInt(rawSize.trim(), 10);
    if (!Number.isFinite(crc) || !Number.isFinite(size) || size < 0) continue;
    if (size > MAX_FILE_BYTES) continue;

    entries.push({ path: safePath, crc32: crc >>> 0, size });
  }

  return entries;
}

/**
 * Blacklist and notshared hold bare paths, sometimes with trailing fields.
 */
export function parsePathList(text: string): string[] {
  const paths: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;
    const safePath = sanitizeEntryPath(trimmed.split('|')[0] ?? '');
    if (safePath) paths.push(safePath);
  }

  return paths;
}

export function parseVersion(cfgText: string): string {
  for (const line of cfgText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('version|')) return trimmed.slice('version|'.length).trim();
  }
  return '';
}

/**
 * Read the remote manifest set for an addon.
 */
export async function fetchManifest(
  baseUrl: string
): Promise<Result<SkunkCraftsManifest, UpdateError>> {
  const root = baseUrl.replace(/\/+$/, '');

  const cfg = await fetchText(`${root}/${CFG_FILE}`, MAX_MANIFEST_BYTES);
  if (!cfg.ok) return cfg;

  const whitelist = await fetchText(`${root}/${WHITELIST_FILE}`, MAX_MANIFEST_BYTES);
  if (!whitelist.ok) return whitelist;

  const files = parseWhitelist(whitelist.value);
  if (files.length === 0) {
    return err({ code: 'MANIFEST_INVALID', reason: 'whitelist has no usable entries' });
  }

  const total = files.reduce((sum, file) => sum + file.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    return err({ code: 'SIZE_EXCEEDED', size: total, limit: MAX_TOTAL_BYTES });
  }

  // The optional manifests are absent for most addons, so a failure to fetch
  // them is not a failure to update.
  const blacklist = await fetchText(`${root}/${BLACKLIST_FILE}`, MAX_MANIFEST_BYTES);
  const notshared = await fetchText(`${root}/${NOTSHARED_FILE}`, MAX_MANIFEST_BYTES);

  return ok({
    version: parseVersion(cfg.value),
    baseUrl: root,
    files,
    blacklist: blacklist.ok ? parsePathList(blacklist.value) : [],
    once: notshared.ok ? parsePathList(notshared.value) : [],
  });
}

/**
 * Compare the manifest with what is on disk.
 */
export async function planUpdate(
  localDir: string,
  manifest: SkunkCraftsManifest
): Promise<UpdatePlan> {
  const onceSet = new Set(manifest.once);
  const download: ManifestEntry[] = [];
  let unchangedCount = 0;

  for (const entry of manifest.files) {
    const localPath = path.join(localDir, ...entry.path.split('/'));

    let local: Buffer;
    try {
      local = await fsp.readFile(localPath);
    } catch {
      download.push(entry);
      continue;
    }

    // A "not shared" file is the user's own: config, liveries, logs. Once it
    // exists it is left exactly as the user left it.
    if (onceSet.has(entry.path)) {
      unchangedCount++;
      continue;
    }

    if (local.length === entry.size && crc32(local) === entry.crc32) {
      unchangedCount++;
      continue;
    }

    download.push(entry);
  }

  const remove: string[] = [];
  for (const candidate of manifest.blacklist) {
    const localPath = path.join(localDir, ...candidate.split('/'));
    try {
      await fsp.access(localPath);
      remove.push(candidate);
    } catch {
      // Already gone
    }
  }

  return {
    version: manifest.version,
    download,
    remove,
    unchangedCount,
    downloadBytes: download.reduce((sum, entry) => sum + entry.size, 0),
  };
}

export interface DownloadProgress {
  completedFiles: number;
  totalFiles: number;
  bytesDownloaded: number;
  bytesTotal: number;
  currentFile: string;
}

export interface DownloadOptions {
  onProgress?: (progress: DownloadProgress) => void;
  isCancelled?: () => boolean;
}

/**
 * Download every changed file into a staging folder, verifying each against
 * the manifest. Nothing touches the install until every file has landed.
 */
export async function downloadUpdate(
  manifest: SkunkCraftsManifest,
  plan: UpdatePlan,
  stagingDir: string,
  options: DownloadOptions = {}
): Promise<Result<string[], UpdateError>> {
  const written: string[] = [];
  let bytesDownloaded = 0;
  let completedFiles = 0;
  let failure: UpdateError | null = null;
  let next = 0;

  const worker = async () => {
    for (;;) {
      if (failure) return;
      const index = next++;
      const entry = plan.download[index];
      if (!entry) return;

      if (options.isCancelled?.()) {
        failure = { code: 'CANCELLED' };
        return;
      }

      const url = `${manifest.baseUrl}/${entry.path}`;
      if (!isAllowedUpdateUrl(url)) {
        failure = { code: 'INVALID_URL', url };
        return;
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      let body: Buffer;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) {
          failure = { code: 'FETCH_FAILED', url, status: response.status };
          return;
        }
        body = Buffer.from(await response.arrayBuffer());
      } catch {
        failure = { code: 'FETCH_FAILED', url, status: 0 };
        return;
      } finally {
        clearTimeout(timeout);
      }

      if (body.length !== entry.size || crc32(body) !== entry.crc32) {
        failure = { code: 'VERIFY_FAILED', path: entry.path };
        return;
      }

      const target = path.join(stagingDir, ...entry.path.split('/'));
      try {
        await fsp.mkdir(path.dirname(target), { recursive: true });
        await fsp.writeFile(target, body);
      } catch (e) {
        failure = {
          code: 'WRITE_FAILED',
          path: entry.path,
          reason: e instanceof Error ? e.message : String(e),
        };
        return;
      }

      written.push(entry.path);
      bytesDownloaded += body.length;
      completedFiles++;
      options.onProgress?.({
        completedFiles,
        totalFiles: plan.download.length,
        bytesDownloaded,
        bytesTotal: plan.downloadBytes,
        currentFile: entry.path,
      });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, plan.download.length) }, worker)
  );

  return failure ? err(failure) : ok(written);
}
