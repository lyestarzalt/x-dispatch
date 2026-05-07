import { spawn } from 'child_process';
import logger from '@/lib/utils/logger';

export interface SpawnInput {
  exePath: string;
  args?: string;
  cwd?: string;
}

export interface SpawnResult {
  success: boolean;
  error?: string;
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
    return { success: false, error: msg };
  }
}
