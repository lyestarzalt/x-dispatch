import { spawn } from 'child_process';
import { canExecute } from '@/lib/utils/canExecute';
import { isElevated } from '@/lib/utils/isElevated';
import logger from '@/lib/utils/logger';

export interface SpawnInput {
  exePath: string;
  args?: string;
  cwd?: string;
}

/**
 * Stable error codes the renderer maps to localized toasts. Keep this in sync
 * with the i18n keys under `settings.companionApps.error.*`.
 */
export type SpawnErrorCode =
  | 'NEEDS_ADMIN'
  | 'FILE_MISSING'
  | 'FILE_NOT_EXECUTABLE'
  | 'SPAWN_FAILED';

export interface SpawnResult {
  success: boolean;
  error?: string;
  code?: SpawnErrorCode;
}

/**
 * Pre-flight + spawn. Runs the elevation guard and the access guard before
 * touching `child_process.spawn`, since both checks fail synchronously with
 * clear codes — unlike spawn, which fires async errors that we'd drop.
 */
export function launchCompanionApp(input: SpawnInput): SpawnResult {
  if (!isElevated()) {
    logger.main.warn(`companionApps refused launch: not elevated (exe=${input.exePath})`);
    return {
      success: false,
      code: 'NEEDS_ADMIN',
      error: 'X-Dispatch is not running as administrator',
    };
  }

  const access = canExecute(input.exePath);
  if (!access.ok) {
    const code: SpawnErrorCode =
      access.reason === 'missing' ? 'FILE_MISSING' : 'FILE_NOT_EXECUTABLE';
    logger.main.warn(
      `companionApps refused launch: ${access.reason} (exe=${input.exePath}, ${access.error})`
    );
    return { success: false, code, error: access.error };
  }

  return spawnDetached(input);
}

export function spawnDetached(input: SpawnInput): SpawnResult {
  try {
    const argv = input.args?.trim() ? input.args.trim().split(/\s+/) : [];
    const child = spawn(input.exePath, argv, {
      detached: true,
      stdio: 'ignore',
      cwd: input.cwd,
    });
    child.on('error', (err) => {
      logger.main.warn(`companionApps spawn error after launch: ${err.message}`);
    });
    child.unref();
    logger.main.info(`companionApps spawned: ${input.exePath}`);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.main.warn(`companionApps spawn threw: ${msg}`);
    return { success: false, error: msg, code: 'SPAWN_FAILED' };
  }
}
