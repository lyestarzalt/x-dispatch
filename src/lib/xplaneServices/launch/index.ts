import { exec, spawn } from 'child_process';
import * as fs from 'fs';
import logger from '@/lib/utils/logger';
import type { Aircraft, LaunchConfig, WeatherPreset } from '@/types/aircraft';
import { isXPlaneProcessRunning } from '../client/processCheck';
import { scanAircraftDirectory } from './acfParser';
import {
  calculateFuelWeights,
  generateFreeflightPrf,
  getCurrentDayOfYear,
  getCurrentTimeInHours,
  getXPlaneExecutable,
  writeFreeflightPrf,
} from './freeflightGenerator';
import { WEATHER_PRESETS } from './types';

// Steam App IDs
const STEAM_APP_IDS = {
  'X-Plane 12': '2014780',
  'X-Plane 11': '269950',
} as const;

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
   * Launch X-Plane with the given configuration
   */
  async launch(config: LaunchConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if X-Plane process is already running
      const isRunning = await isXPlaneProcessRunning();
      if (isRunning) {
        logger.launcher.warn('X-Plane is already running');
        return { success: false, error: 'X-Plane is already running' };
      }

      // Generate Freeflight.prf content
      const prfContent = generateFreeflightPrf(config);
      const writeSuccess = writeFreeflightPrf(this.xplanePath, prfContent);
      if (!writeSuccess) {
        return { success: false, error: 'Failed to write Freeflight.prf' };
      }

      const xplaneArgs = ['--pref:_show_qfl_on_start=0', '--no_save_prefs'];
      const startRunning = config.startEngineRunning ?? true;
      xplaneArgs.push(`--start_running=${startRunning}`);

      // macOS + Steam installation: launch via Steam URL protocol
      if (process.platform === 'darwin' && isSteamInstallation(this.xplanePath)) {
        const appId = getSteamAppId(this.xplanePath);
        logger.launcher.info(`Launching X-Plane via Steam (macOS, appId: ${appId})`);

        // Format: steam://rungameid/<appid>//<args>/
        // Args separated by %20, entire args section URL-encoded
        const argsEncoded = xplaneArgs.map((arg) => encodeURIComponent(arg)).join('%20');
        const steamUrl = `steam://rungameid/${appId}//${argsEncoded}/`;

        exec(`open "${steamUrl}"`, (error) => {
          if (error) {
            logger.launcher.error('Failed to launch via Steam URL', error);
          }
        });

        return { success: true };
      }

      // Direct launch for non-Steam or Windows/Linux
      const executable = getXPlaneExecutable(this.xplanePath);
      if (!executable) {
        return { success: false, error: 'X-Plane executable not found' };
      }

      logger.launcher.info(`Launching X-Plane directly: ${executable}`);

      // Use shell on Windows to handle paths with spaces and avoid EACCES errors
      const spawnOptions: Parameters<typeof spawn>[2] = {
        detached: true,
        stdio: 'ignore',
        ...(process.platform === 'win32' && { shell: true }),
      };

      const xplaneProcess = spawn(executable, xplaneArgs, spawnOptions);

      // Handle spawn errors (e.g., EACCES, ENOENT)
      xplaneProcess.on('error', (err) => {
        logger.launcher.error('Failed to spawn X-Plane process', err);
      });

      // Unref the process so it can run independently
      xplaneProcess.unref();

      return { success: true };
    } catch (err) {
      logger.launcher.error('Launch failed', err);
      return { success: false, error: (err as Error).message };
    }
  }

  /**
   * Create a default launch config for an aircraft and start position
   */
  createDefaultConfig(
    aircraft: Aircraft,
    airport: string,
    position: string,
    positionType: 'runway' | 'ramp',
    airportLat: number,
    airportLon: number,
    positionIndex: number = 0,
    xplaneIndex?: number
  ): LaunchConfig {
    return {
      aircraft,
      livery: 'Default',
      fuel: {
        percentage: 50,
        tankWeights: calculateFuelWeights(aircraft.maxFuel, 50, aircraft.tankNames.length || 2),
      },
      startPosition: {
        type: positionType,
        airport,
        position,
        index: positionIndex,
        xplaneIndex,
      },
      time: {
        dayOfYear: getCurrentDayOfYear(),
        timeInHours: getCurrentTimeInHours(),
        latitude: airportLat,
        longitude: airportLon,
      },
      weather: WEATHER_PRESETS[0], // Clear weather by default
    };
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
