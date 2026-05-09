// `@recent-cli/resolve-lnk` is a pure-JS MIT parser for the MS-SHLLINK
// binary format (Windows .lnk shortcuts). Wrapping behind this single
// file means a future swap (or vendoring the ~80-line parser into the
// repo if the package goes stale) is one-file change.
import { resolveBuffer } from '@recent-cli/resolve-lnk';
import * as fs from 'fs';

export type ResolveLnkResult =
  | { ok: true; targetPath: string }
  | {
      ok: false;
      reason: 'not-lnk' | 'parse-error' | 'no-target' | 'io-error';
      error?: string;
    };

/**
 * Read a `.lnk` file and return its target path.
 *
 * Sync because both consumers (SceneryManager and customSceneryLoader)
 * are already sync. Returning a structured result keeps the failure
 * modes explicit rather than throwing strings.
 */
export function resolveLnkSync(filePath: string): ResolveLnkResult {
  if (!filePath.toLowerCase().endsWith('.lnk')) {
    return { ok: false, reason: 'not-lnk' };
  }

  let buffer: Buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (err) {
    return { ok: false, reason: 'io-error', error: (err as Error).message };
  }

  let target: unknown;
  try {
    target = resolveBuffer(buffer);
  } catch (err) {
    return { ok: false, reason: 'parse-error', error: (err as Error).message };
  }

  if (typeof target !== 'string' || target.length === 0) {
    return { ok: false, reason: 'no-target' };
  }

  return { ok: true, targetPath: target };
}
