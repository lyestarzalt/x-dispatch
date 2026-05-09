import * as fs from 'fs';

export type CanExecuteResult =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'denied' | 'unknown'; error: string };

/**
 * Pre-flight check that surfaces "file moved" and "file not executable" before
 * we hand off to `child_process.spawn`, where these errors arrive asynchronously
 * and are easy to drop on the floor.
 *
 * On Windows the X_OK bit is largely cosmetic — `accessSync` mostly catches
 * ENOENT there. That's still useful: a renamed/moved exe is the most common
 * companion-app failure mode.
 */
export function canExecute(filePath: string): CanExecuteResult {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return { ok: true };
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    const message = e.message ?? String(err);
    if (e.code === 'ENOENT') return { ok: false, reason: 'missing', error: message };
    if (e.code === 'EACCES') return { ok: false, reason: 'denied', error: message };
    return { ok: false, reason: 'unknown', error: message };
  }
}
