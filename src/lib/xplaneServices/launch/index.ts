import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft, WeatherPreset } from '@/types/aircraft';
import { isXPlaneProcessRunning } from '../client/processCheck';
import { scanAircraftDirectory } from './acfParser';
import { getXPlaneExecutable } from './freeflightGenerator';
import { WEATHER_PRESETS } from './types';

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
   * Writes raw payload to a temp JSON file and passes --new_flight_json flag.
   */
  async launch(payload: FlightInit): Promise<{ success: boolean; error?: string }> {
    try {
      const isRunning = await isXPlaneProcessRunning();
      if (isRunning) {
        logger.launcher.warn('X-Plane is already running');
        return {
          success: false,
          error: 'X-Plane is already running. Use the Change Flight button instead.',
        };
      }

      // Same FlightInit schema as REST API, but NO { data: ... } wrapper for CLI
      const flightJson = payload;
      const jsonPath = path.join(os.tmpdir(), 'x-dispatch-flight.json');
      fs.writeFileSync(jsonPath, JSON.stringify(flightJson, null, 2), 'utf-8');
      logger.launcher.info(`Flight JSON written to: ${jsonPath}`);
      logger.launcher.info(`Flight JSON: ${JSON.stringify(flightJson)}`);

      const xplaneArgs = [`=${jsonPath}`];

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
        return { success: false, error: 'X-Plane executable not found' };
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

      const xplaneProcess = spawn(executable, xplaneArgs, spawnOptions);

      // Handle spawn errors (e.g., EACCES, ENOENT)
      xplaneProcess.on('error', (err) => {
        logger.launcher.error(`Spawn error: ${err.message}`, err);
      });

      // Unref the process so it can run independently
      xplaneProcess.unref();

      logger.launcher.info(`Spawn completed, process unref'd`);
      return { success: true };
    } catch (err) {
      logger.launcher.error('Launch failed', err);
      return { success: false, error: (err as Error).message };
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
