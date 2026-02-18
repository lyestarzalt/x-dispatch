import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { LaunchConfig } from '@/types/aircraft';
import { generateAircraftKey } from './acfParser';
import { DEFAULT_WEATHER_DEFINITION } from './types';

export function generateFreeflightPrf(config: LaunchConfig): string {
  const aircraftKey = generateAircraftKey(config.aircraft.path);
  const lines: string[] = [];

  // File header
  lines.push('I');
  lines.push('1100 Version');

  // Airport and start position
  // Runways and helipads use _default_to_ramps = 0, only ramps use 1
  const isRamp = config.startPosition.type === 'ramp';
  lines.push(`_default_to_ramps ${isRamp ? '1' : '0'}`);
  lines.push(`_airport ${config.startPosition.airport}`);

  // Start position JSON - this should control the actual ramp/runway by name
  const startJson = generateStartPositionJson(config.startPosition);
  lines.push(`_last_start ${startJson}`);

  // No AI aircraft
  lines.push('');
  lines.push('_other_aircraft {"ai_aircraft":null}');

  // Time configuration
  const timeJson = generateTimeJson(config.time);
  lines.push('');
  lines.push(`_time ${timeJson}`);

  // Aircraft path
  lines.push('');
  lines.push(`_aircraft ${config.aircraft.path}`);

  // Weather
  const weatherDef = config.weather?.definition || DEFAULT_WEATHER_DEFINITION;
  lines.push(`_wxr_def ${weatherDef}`);
  lines.push('_wxr_use_rvr 0');

  // Weight and balance (fuel)
  const weightJson = generateWeightJson(config.fuel);
  lines.push(`P _weight_and_balance ${aircraftKey} ${weightJson}`);

  // Livery
  lines.push(`P _livery ${aircraftKey} ${config.livery}`);

  // Per-airport settings
  const icao = config.startPosition.airport;
  // Runways and helipads use _start_is_rwy = 1, only ramps use 0
  lines.push(`P _start_is_rwy ${icao} ${isRamp ? '0' : '1'}`);
  // X-Plane uses separate indices for gate vs non-gate positions
  if (config.startPosition.xplaneIndex === undefined) {
    throw new Error(
      `Missing xplaneIndex for start position "${config.startPosition.position}" - this is required for correct X-Plane spawning`
    );
  }
  lines.push(`P _rwy_or_ramp ${icao} ${config.startPosition.xplaneIndex}`);

  return lines.join('\n');
}

function generateStartPositionJson(startPosition: {
  type: 'runway' | 'ramp';
  airport: string;
  position: string;
}): string {
  if (startPosition.type === 'ramp') {
    return JSON.stringify({
      ramp_start: {
        airport_id: startPosition.airport,
        ramp: startPosition.position,
      },
    });
  } else {
    // Runways and helipads both use runway_start
    return JSON.stringify({
      runway_start: {
        airport_id: startPosition.airport,
        runway: startPosition.position,
      },
    });
  }
}

function generateTimeJson(time: {
  dayOfYear: number;
  timeInHours: number;
  latitude: number;
  longitude: number;
}): string {
  return JSON.stringify({
    local_time: {
      day_of_year: time.dayOfYear,
      latitude: time.latitude,
      longitude: time.longitude,
      time_in_24_hours: time.timeInHours,
    },
  });
}

function generateWeightJson(fuel: { tankWeights: number[] }): string {
  const tankWeights = [...fuel.tankWeights];
  while (tankWeights.length < 9) {
    tankWeights.push(0);
  }

  return JSON.stringify({
    weight: {
      deice_fluid_in_liters: 0.0,
      deice_holdover_time_in_minutes: 0.0,
      fueltank_weight_in_kilograms: tankWeights.slice(0, 9),
      oxygen_pressure_in_millibars: 124105.65,
      payload_weight_in_kilograms: [0, 0, 0, 0, 0],
    },
  });
}

export function calculateFuelWeights(
  maxFuel: number,
  percentage: number,
  tankCount: number = 2
): number[] {
  const totalFuel = maxFuel * (percentage / 100);
  const weights: number[] = new Array(9).fill(0);

  if (tankCount >= 2) {
    weights[0] = totalFuel / 2;
    weights[2] = totalFuel / 2;
  } else if (tankCount === 1) {
    weights[0] = totalFuel;
  }

  return weights;
}

export function writeFreeflightPrf(xplanePath: string, content: string): boolean {
  try {
    const prefsDir = path.join(xplanePath, 'Output', 'preferences');
    const prfPath = path.join(prefsDir, 'Freeflight.prf');

    if (!fs.existsSync(prefsDir)) {
      fs.mkdirSync(prefsDir, { recursive: true });
    }

    if (fs.existsSync(prfPath)) {
      const backupPath = path.join(prefsDir, 'Freeflight.prf.backup');
      fs.copyFileSync(prfPath, backupPath);
    }

    fs.writeFileSync(prfPath, content, 'utf-8');
    return true;
  } catch (err) {
    logger.launcher.error('Failed to write Freeflight.prf', err);
    return false;
  }
}

export function getXPlaneExecutable(xplanePath: string): string | null {
  const platform = process.platform;

  if (platform === 'darwin') {
    const macPath = path.join(xplanePath, 'X-Plane.app', 'Contents', 'MacOS', 'X-Plane');
    if (fs.existsSync(macPath)) {
      return macPath;
    }
  } else if (platform === 'win32') {
    const winPath = path.join(xplanePath, 'X-Plane.exe');
    if (fs.existsSync(winPath)) {
      return winPath;
    }
  } else {
    const linuxPath = path.join(xplanePath, 'X-Plane-x86_64');
    if (fs.existsSync(linuxPath)) {
      return linuxPath;
    }
  }

  return null;
}

export function getCurrentDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

export function getCurrentTimeInHours(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}
