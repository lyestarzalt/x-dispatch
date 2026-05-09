import path from 'path';

export type ValidateDownloadArgs = {
  url: unknown;
  targetDir: unknown;
  filename: unknown;
};

export type ValidateDownloadResult =
  | { ok: true; url: string; targetDir: string; filename: string }
  | { ok: false; error: string };

/**
 * Pure validator for `simbrief:downloadFmsFile` IPC arguments.
 * Lives in lib so it can be unit-tested without Electron.
 *
 * Rules:
 * - URL must be `https://` and resolve to a SimBrief host.
 * - targetDir must be an absolute path.
 * - filename must be a basename — no path separators, no `..`/`.` segments.
 *   Embedded `..` inside an otherwise-flat filename (e.g. `OFP..fms`) is fine
 *   because `path.basename` returns the input unchanged in that case.
 */
export function validateDownloadArgs(args: ValidateDownloadArgs): ValidateDownloadResult {
  const { url, targetDir, filename } = args;

  if (typeof url !== 'string' || !url.startsWith('https://')) {
    return { ok: false, error: 'Invalid URL' };
  }
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, error: 'Malformed URL' };
  }
  if (!host.endsWith('.simbrief.com') && host !== 'simbrief.com') {
    return { ok: false, error: `Refusing to download from ${host}` };
  }

  if (typeof targetDir !== 'string' || !path.isAbsolute(targetDir)) {
    return { ok: false, error: 'targetDir must be an absolute path' };
  }

  if (typeof filename !== 'string' || filename.length === 0) {
    return { ok: false, error: 'Invalid filename: empty' };
  }
  if (filename === '.' || filename === '..') {
    return { ok: false, error: `Invalid filename: ${filename}` };
  }
  // path.basename strips any leading directory parts on either platform.
  // If the result differs, the input contained a path separator.
  if (path.basename(filename) !== filename) {
    return { ok: false, error: `Invalid filename: ${JSON.stringify(filename)}` };
  }

  return { ok: true, url, targetDir, filename };
}
