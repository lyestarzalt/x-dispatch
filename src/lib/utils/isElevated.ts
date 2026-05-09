import { spawnSync } from 'child_process';

/**
 * Detect whether the current process is running with administrative privileges.
 *
 * - POSIX (macOS/Linux): effective UID is 0 (root).
 * - Windows: `fltmc.exe` exists in every supported Windows version and only
 *   succeeds when the caller is in the elevated High-Integrity token group.
 *   A non-admin invocation exits non-zero.
 *
 * The result is cached for the lifetime of the process — elevation can't change
 * mid-session without restarting the app.
 */

export interface ElevationContext {
  platform: NodeJS.Platform;
  geteuid?: () => number;
  /** Override for unit tests. Defaults to the fltmc-based check. */
  windowsCheck?: () => boolean;
}

export function detectElevation(ctx: ElevationContext): boolean {
  if (ctx.platform === 'win32') {
    return (ctx.windowsCheck ?? defaultWindowsCheck)();
  }
  const euid = ctx.geteuid?.();
  return typeof euid === 'number' && euid === 0;
}

function defaultWindowsCheck(): boolean {
  try {
    const result = spawnSync('fltmc', [], { stdio: 'ignore', windowsHide: true });
    return result.status === 0;
  } catch {
    return false;
  }
}

let cached: boolean | null = null;

/**
 * Returns whether the process is currently elevated. Computed once and cached.
 */
export function isElevated(): boolean {
  if (cached !== null) return cached;
  cached = detectElevation({
    platform: process.platform,
    geteuid: process.geteuid?.bind(process),
  });
  return cached;
}

/** Test-only: clear the cache so each test sees a fresh detection. */
export function _resetElevationCache(): void {
  cached = null;
}
