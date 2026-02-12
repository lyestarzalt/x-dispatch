import { spawn } from 'child_process';
import logger from '../logger';
import { isXPlaneProcessRunning } from '../xplane/processCheck';
import { scanAircraftDirectory } from './acfParser';
import {
  calculateFuelWeights,
  generateFreeflightPrf,
  getCurrentDayOfYear,
  getCurrentTimeInHours,
  getXPlaneExecutable,
  writeFreeflightPrf,
} from './freeflightGenerator';
import type { Aircraft, LaunchConfig, WeatherPreset } from './types';
import { WEATHER_PRESETS } from './types';

export type { Aircraft, LaunchConfig, WeatherPreset };
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

      const executable = getXPlaneExecutable(this.xplanePath);
      if (!executable) {
        return { success: false, error: 'X-Plane executable not found' };
      }

      logger.launcher.info('Launching X-Plane');

      const launchArgs = ['--pref:_show_qfl_on_start=0'];
      const startRunning = config.startEngineRunning ?? true;
      launchArgs.push(`--start_running=${startRunning}`);

      const xplaneProcess = spawn(executable, launchArgs, {
        detached: true,
        stdio: 'ignore',
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
    airportLon: number
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
