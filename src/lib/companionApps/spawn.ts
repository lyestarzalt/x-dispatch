import { type ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import { errorMessage } from '@/lib/utils/errors';
import logger from '@/lib/utils/logger';
import {
  POWERSHELL_FLAGS,
  buildStartProcessScript,
  classifyStartProcessFailure,
  encodePowerShellCommand,
  splitArguments,
  windowsPowerShellPath,
} from './startProcess';

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
  'FILE_MISSING' | 'ACCESS_DENIED' | 'CANCELLED' | 'TIMED_OUT' | 'SPAWN_FAILED';

export interface SpawnResult {
  success: boolean;
  error?: string;
  code?: SpawnErrorCode;
}

export interface LaunchDeps {
  /** Where Windows PowerShell is; the default is its fixed place under SystemRoot. */
  powerShellPath?: string;
  /** How long to wait for Windows to start the app, UAC prompt included. */
  timeoutMs?: number;
}

/** A UAC prompt waits for the user; two minutes covers a slow answer without hanging a launch. */
const WINDOWS_LAUNCH_TIMEOUT_MS = 120_000;

/**
 * Starts a companion app and resolves once the OS has started it or refused it.
 *
 * On Windows the app is started through PowerShell's `Start-Process`, which is
 * `ShellExecute`: the call Explorer makes on a double click. Windows then shows
 * its own UAC prompt for an app whose manifest asks for administrator rights
 * (vPilot, some hardware drivers), and batch files and shortcuts open as they
 * do from Explorer. Node's `spawn` is `CreateProcess`, which refuses all three.
 * Heroic Games Launcher and the `open` package launch the same way.
 *
 * On macOS and Linux a user app can start another user app directly, so the
 * app is spawned detached, the way GitHub Desktop starts an editor.
 */
export async function launchCompanionApp(
  input: SpawnInput,
  deps: LaunchDeps = {}
): Promise<SpawnResult> {
  if (!isFile(input.exePath)) {
    logger.main.warn(`companionApps refused launch: no file at ${input.exePath}`);
    return { success: false, code: 'FILE_MISSING', error: `No file at ${input.exePath}` };
  }
  if (process.platform !== 'win32') return spawnDetached(input);

  const powerShell = deps.powerShellPath ?? windowsPowerShellPath();
  if (!isFile(powerShell)) {
    // Windows PowerShell 5.1 is part of Windows; a machine without it is one
    // where policy removed it. Starting the app directly still covers every app
    // that does not need administrator rights.
    logger.main.warn(`companionApps: no PowerShell at ${powerShell}, spawning directly`);
    return spawnDetached(input);
  }
  return startProcess(input, powerShell, deps.timeoutMs ?? WINDOWS_LAUNCH_TIMEOUT_MS);
}

function isFile(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** Runs the `Start-Process` script and reads its exit code and stderr. */
function startProcess(
  input: SpawnInput,
  powerShell: string,
  timeoutMs: number
): Promise<SpawnResult> {
  const script = buildStartProcessScript(input);
  let child: ChildProcess;
  try {
    child = spawn(
      powerShell,
      [...POWERSHELL_FLAGS, '-EncodedCommand', encodePowerShellCommand(script)],
      { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true }
    );
  } catch (err) {
    const msg = errorMessage(err);
    logger.main.warn(`companionApps: PowerShell did not start: ${msg}`);
    return Promise.resolve({ success: false, error: msg, code: 'SPAWN_FAILED' });
  }

  return new Promise<SpawnResult>((resolve) => {
    let stderr = '';
    let settled = false;
    const settle = (result: SpawnResult): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      logger.main.warn(
        `companionApps: Windows did not start ${input.exePath} within ${timeoutMs} ms`
      );
      settle({ success: false, code: 'TIMED_OUT', error: `No answer within ${timeoutMs} ms` });
    }, timeoutMs);

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.once('error', (err) => {
      const msg = errorMessage(err);
      logger.main.warn(`companionApps: PowerShell failed: ${msg}`);
      settle({ success: false, error: msg, code: 'SPAWN_FAILED' });
    });
    child.once('close', (code) => {
      if (code === 0) {
        logger.main.info(`companionApps started: ${input.exePath}`);
        settle({ success: true });
        return;
      }
      const reason = stderr.trim();
      const failure = classifyStartProcessFailure(reason);
      logger.main.warn(`companionApps: Windows refused ${input.exePath} (${failure}): ${reason}`);
      // Drop the leading Win32 code; the message is what the toast shows.
      settle({ success: false, code: failure, error: reason.replace(/^-?\d+\s*/, '') });
    });
  });
}

/**
 * Starts the process detached and resolves once the OS has started it or
 * refused it. Node emits exactly one of `spawn` and `error` for a launch, and
 * a refusal only ever arrives as the async `error`, never as a throw.
 */
export function spawnDetached(input: SpawnInput): Promise<SpawnResult> {
  let child: ChildProcess;
  try {
    child = spawn(input.exePath, splitArguments(input.args), {
      detached: true,
      stdio: 'ignore',
      cwd: input.cwd,
    });
  } catch (err) {
    const msg = errorMessage(err);
    logger.main.warn(`companionApps spawn threw: ${msg}`);
    return Promise.resolve({ success: false, error: msg, code: 'SPAWN_FAILED' });
  }

  return new Promise<SpawnResult>((resolve) => {
    child.once('spawn', () => {
      child.unref();
      logger.main.info(`companionApps spawned: ${input.exePath}`);
      resolve({ success: true });
    });
    child.once('error', (err: NodeJS.ErrnoException) => {
      const code: SpawnErrorCode =
        err.code === 'ENOENT'
          ? 'FILE_MISSING'
          : err.code === 'EACCES' || err.code === 'EPERM'
            ? 'ACCESS_DENIED'
            : 'SPAWN_FAILED';
      logger.main.warn(`companionApps spawn refused (${code}): ${err.message}`);
      resolve({ success: false, error: err.message, code });
    });
  });
}
