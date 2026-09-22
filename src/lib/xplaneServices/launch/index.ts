import * as Sentry from '@sentry/electron/main';
import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { getCliFlags } from '@/lib/cli';
import { isElevated } from '@/lib/utils/isElevated';
import logger from '@/lib/utils/logger';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft, WeatherPreset } from '@/types/aircraft';
import { isXPlaneProcessRunning } from '../client/processCheck';
import { scanAircraftDirectory } from './acfParser';
import { RESERVED_XP_ARG, filterReservedXpArgs } from './cliArgs';
import { validateNewFlight } from './flightInit/schema';
import { getXPlaneExecutable } from './freeflightGenerator';
import { WEATHER_PRESETS } from './types';

/**
 * Stable reasons a launch can fail, in place of raw Node errnos. The renderer
 * maps these to messages, so keep in sync with the i18n keys under `launcher.*`.
 * Mirrors `SpawnErrorCode` in `@/lib/companionApps/spawn`.
 */
export type LaunchErrorCode =
  | 'ALREADY_RUNNING'
  | 'PATH_NOT_CONFIGURED'
  | 'INVALID_CONFIG'
  | 'EXE_NOT_FOUND'
  | 'NEEDS_ADMIN'
  | 'ACCESS_BLOCKED'
  | 'SPAWN_FAILED';

export interface LaunchResult {
  success: boolean;
  error?: string;
  code?: LaunchErrorCode;
}

/**
 * Decide what a spawn-time errno actually means.
 *
 * Windows `CreateProcess` cannot elevate. An executable manifested
 * `requireAdministrator` fails with `ERROR_ELEVATION_REQUIRED` (740), and libuv
 * maps 740 to `EACCES` — but `ERROR_ACCESS_DENIED` (5) maps to `EACCES` as well,
 * so the errno alone cannot separate "needs admin" from "antivirus, ACLs or
 * Controlled Folder Access refused it". Our own elevation state breaks the tie:
 * if we are already elevated, elevation cannot be what Windows objected to.
 *
 * On POSIX there is no UAC — `EACCES` there means the executable bit or a path
 * component denies us, which no amount of elevation prompting would fix.
 */
export function classifySpawnError(
  errno: string | undefined,
  ctx: { platform: NodeJS.Platform; elevated: boolean }
): LaunchErrorCode {
  if (errno === 'ENOENT') return 'EXE_NOT_FOUND';
  if (errno === 'EACCES' || errno === 'EPERM') {
    if (ctx.platform !== 'win32') return 'ACCESS_BLOCKED';
    return ctx.elevated ? 'ACCESS_BLOCKED' : 'NEEDS_ADMIN';
  }
  return 'SPAWN_FAILED';
}

/** Best-effort facts about the target, for the Sentry breadcrumb only. */
function describeExecutable(executable: string): { exists: boolean; isFile: boolean } {
  try {
    return { exists: true, isFile: fs.statSync(executable).isFile() };
  } catch {
    return { exists: false, isFile: false };
  }
}

// Steam App IDs
const STEAM_APP_IDS = {
  'X-Plane 12': '2014780',
  'X-Plane 11': '269950',
} as const;

// TODO: Check for a better way to detect if Steam version
/**
 * Check if the X-Plane installation is from Steam
 */
function isSteamInstallation(xplanePath: string): boolean {
  // Check if path contains Steam directories
  if (xplanePath.toLowerCase().includes('steamapps')) {
    return true;
  }
  // Check for steam_appid.txt file
  const steamAppIdFile = `${xplanePath}/steam_appid.txt`;
  return fs.existsSync(steamAppIdFile);
}

/**
 * Get Steam App ID based on X-Plane version in path
 */
function getSteamAppId(xplanePath: string): string {
  if (xplanePath.includes('X-Plane 11')) {
    return STEAM_APP_IDS['X-Plane 11'];
  }
  // Default to X-Plane 12
  return STEAM_APP_IDS['X-Plane 12'];
}

export { WEATHER_PRESETS };

class XPlaneLauncher {
  private xplanePath: string;
  private aircraftCache: Aircraft[] | null = null;

  constructor(xplanePath: string) {
    this.xplanePath = xplanePath;
  }

  scanAircraft(): Aircraft[] {
    this.aircraftCache = scanAircraftDirectory(this.xplanePath);
    logger.launcher.info(`Scanned ${this.aircraftCache.length} aircraft`);
    return this.aircraftCache;
  }

  getAircraft(): Aircraft[] {
    if (this.aircraftCache === null) {
      return this.scanAircraft();
    }
    return this.aircraftCache;
  }

  /**
   * Clear aircraft cache (forces rescan on next getAircraft call)
   */
  clearCache(): void {
    this.aircraftCache = null;
  }

  getWeatherPresets(): WeatherPreset[] {
    return WEATHER_PRESETS;
  }

  /**
   * Launch X-Plane with FlightInit payload (same schema as REST API, no { data } wrapper).
   * Writes raw payload to a temp JSON file and hands it to X-Plane on launch.
   */
  async launch(payload: FlightInit, extraArgs?: string[]): Promise<LaunchResult> {
    try {
      payload = validateNewFlight(payload);
    } catch (error) {
      return { success: false, error: (error as Error).message, code: 'INVALID_CONFIG' };
    }
    try {
      const isRunning = await isXPlaneProcessRunning();
      if (isRunning) {
        logger.launcher.warn('X-Plane is already running');
        return {
          success: false,
          error: 'X-Plane is already running. Use the Change Flight button instead.',
          code: 'ALREADY_RUNNING',
        };
      }

      // Same FlightInit schema as REST API, but NO { data: ... } wrapper for CLI
      const flightJson = payload;
      const jsonPath = path.join(os.tmpdir(), 'x-dispatch-flight.json');
      fs.writeFileSync(jsonPath, JSON.stringify(flightJson, null, 2), 'utf-8');
      logger.launcher.info(`Flight JSON written to: ${jsonPath}`);
      logger.launcher.info(`Flight JSON: ${JSON.stringify(flightJson)}`);

      const xplaneArgs = [`${RESERVED_XP_ARG}=${jsonPath}`];

      if (extraArgs?.length) {
        xplaneArgs.push(...extraArgs);
      }

      const cliXpArgs = filterReservedXpArgs(getCliFlags().xpArgs);
      if (cliXpArgs.length) {
        xplaneArgs.push(...cliXpArgs);
        logger.launcher.info(`Appending ${cliXpArgs.length} CLI session args`);
      }

      // macOS + Steam installation: launch via Steam URL protocol
      if (process.platform === 'darwin' && isSteamInstallation(this.xplanePath)) {
        const appId = getSteamAppId(this.xplanePath);

        // Format: steam://rungameid/<appid>//<args>/
        // Args separated by %20, entire args section URL-encoded
        const argsEncoded = xplaneArgs.map((arg) => encodeURIComponent(arg)).join('%20');
        const steamUrl = `steam://rungameid/${appId}//${argsEncoded}/`;
        const execCmd = `open "${steamUrl}"`;

        logger.launcher.info(`Launch method: Steam URL (macOS)`);
        logger.launcher.info(`Steam App ID: ${appId}`);
        logger.launcher.info(`Steam URL: ${steamUrl}`);
        logger.launcher.info(`Exec command: ${execCmd}`);

        exec(execCmd, (error) => {
          if (error) {
            logger.launcher.error('Failed to launch via Steam URL', error);
          }
        });

        return { success: true };
      }

      // Direct launch for non-Steam or Windows/Linux
      const executable = getXPlaneExecutable(this.xplanePath);
      if (!executable) {
        logger.launcher.error(`X-Plane executable not found in: ${this.xplanePath}`);
        return { success: false, error: 'X-Plane executable not found', code: 'EXE_NOT_FOUND' };
      }

      const spawnOptions: Parameters<typeof spawn>[2] = {
        detached: true,
        stdio: 'ignore',
      };

      logger.launcher.info(`Launch method: Direct spawn`);
      logger.launcher.info(`Platform: ${process.platform}`);
      logger.launcher.info(`Executable: ${executable}`);
      logger.launcher.info(`Arguments: ${xplaneArgs.join(' ')}`);
      logger.launcher.info(`Spawn options: ${JSON.stringify(spawnOptions)}`);

      // Wait for the OS to confirm one of:
      //   - 'spawn'  → the process has been started, we can detach and report success
      //   - 'error'  → the OS refused (ENOENT for a missing exe, EACCES when UAC
      //                blocks a Windows launch without admin, etc.)
      // The two events are mutually exclusive per Node's docs, so a single
      // resolve+cleanup covers both outcomes without races or timeouts.
      // We only catch spawn-time errors here; once 'spawn' fires X-Plane is
      // on its own — internal crashes/exits later aren't surfaced.
      return await new Promise<LaunchResult>((resolve) => {
        const xp = spawn(executable, xplaneArgs, spawnOptions);
        let settled = false;
        const settle = (result: LaunchResult): void => {
          if (settled) return;
          settled = true;
          resolve(result);
        };

        xp.once('spawn', () => {
          // Process is running; detach so it outlives the app.
          xp.unref();
          logger.launcher.info(`Spawn completed, process unref'd`);
          settle({ success: true });
        });

        xp.once('error', (err: NodeJS.ErrnoException) => {
          const elevated = isElevated();
          const code = classifySpawnError(err.code, { platform: process.platform, elevated });

          // The errno on its own has never been enough to triage these — attach
          // what actually separates the causes, so the issue stream can tell us
          // which one dominates instead of us guessing from the message.
          Sentry.withScope((scope) => {
            scope.setContext('launch', {
              errno: err.code ?? null,
              classified: code,
              platform: process.platform,
              elevated,
              isSteam: isSteamInstallation(this.xplanePath),
              ...describeExecutable(executable),
            });
            logger.launcher.error(`Spawn error: ${err.message}`, err);
          });

          settle({ success: false, error: err.message, code });
        });
      });
    } catch (err) {
      logger.launcher.error('Launch failed', err);
      return { success: false, error: (err as Error).message, code: 'SPAWN_FAILED' };
    }
  }
}

// Singleton instance
let launcherInstance: XPlaneLauncher | null = null;

/**
 * Get the launcher instance
 */
export function getLauncher(xplanePath: string): XPlaneLauncher {
  if (!launcherInstance || launcherInstance['xplanePath'] !== xplanePath) {
    launcherInstance = new XPlaneLauncher(xplanePath);
  }
  return launcherInstance;
}
