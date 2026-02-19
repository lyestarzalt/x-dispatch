import logger from '@/lib/utils/logger';
import type { Aircraft, LaunchConfig, WeatherPreset } from '@/types/aircraft';
import { isXPlaneProcessRunning } from '../client/processCheck';
import { scanAircraftDirectory } from './acfParser';
import { executeXPlaneLaunch } from './executor';
import {
  calculateFuelWeights,
  generateFreeflightPrf,
  getCurrentDayOfYear,
  getCurrentTimeInHours,
  writeFreeflightPrf,
} from './freeflightGenerator';
import { WEATHER_PRESETS } from './types';

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

      // Generate Freeflight.prf content (preserves existing user preferences)
      const prfContent = generateFreeflightPrf(config, this.xplanePath);
      const writeSuccess = writeFreeflightPrf(this.xplanePath, prfContent);
      if (!writeSuccess) {
        return { success: false, error: 'Failed to write Freeflight.prf' };
      }

      // Build launch arguments
      const xplaneArgs = ['--pref:_show_qfl_on_start=0', '--no_save_prefs'];
      const startRunning = config.startEngineRunning ?? true;
      xplaneArgs.push(`--start_running=${startRunning}`);

      // Execute launch (handles Steam vs direct, all platforms)
      return await executeXPlaneLaunch(this.xplanePath, xplaneArgs);
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
