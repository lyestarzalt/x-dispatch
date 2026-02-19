import * as fs from 'fs';
import * as path from 'path';
import logger from '@/lib/utils/logger';
import type { LaunchConfig } from '@/types/aircraft';
import { generateAircraftKey } from './acfParser';
import { DEFAULT_WEATHER_DEFINITION } from './types';

// TODO: Refactor - move FreeflightPrf types to types.ts or dedicated file
// TODO: Consider extracting parser/serializer into separate module

// ============================================================================
// Types
// ============================================================================

interface FreeflightPrf {
  /** Global settings (lines without P prefix) */
  globals: Map<string, string>;
  /** Per-item settings (P-prefixed lines): key = "P _type identifier", value = rest of line */
  perItem: Map<string, string>;
}

interface StartPositionConfig {
  type: 'runway' | 'ramp';
  airport: string;
  position: string;
  xplaneIndex?: number | string;
}

interface TimeConfig {
  dayOfYear: number;
  timeInHours: number;
  latitude: number;
  longitude: number;
}

interface FuelConfig {
  tankWeights: number[];
}

// ============================================================================
// Parser
// ============================================================================

/**
 * Parse a Freeflight.prf file into structured data
 */
function parseFreeflightPrf(content: string): FreeflightPrf {
  const globals = new Map<string, string>();
  const perItem = new Map<string, string>();

  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and header
    if (!trimmed || trimmed === 'I' || trimmed === '1100 Version') {
      continue;
    }

    if (trimmed.startsWith('P ')) {
      // Per-item setting: "P _type identifier value"
      // Key format: "P _type identifier" (first 3 parts)
      // Value: everything after identifier
      const withoutP = trimmed.slice(2); // Remove "P "
      const parts = withoutP.split(' ');

      if (parts.length >= 3) {
        const settingType = parts[0]; // e.g., "_livery"
        const identifier = parts[1]; // e.g., aircraft key or ICAO
        const key = `P ${settingType} ${identifier}`;
        const value = parts.slice(2).join(' ');
        perItem.set(key, value);
      } else if (parts.length === 2) {
        // Some P settings might have only 2 parts
        const key = `P ${parts[0]} ${parts[1]}`;
        perItem.set(key, '');
      }
    } else if (trimmed.startsWith('_')) {
      // Global setting: "_key value"
      const spaceIndex = trimmed.indexOf(' ');
      if (spaceIndex > 0) {
        const key = trimmed.slice(0, spaceIndex);
        const value = trimmed.slice(spaceIndex + 1);
        globals.set(key, value);
      } else {
        // Key with no value
        globals.set(trimmed, '');
      }
    }
  }

  return { globals, perItem };
}

/**
 * Read and parse existing Freeflight.prf, or return empty structure if not found
 */
function readExistingPrf(xplanePath: string): FreeflightPrf {
  const prfPath = path.join(xplanePath, 'Output', 'preferences', 'Freeflight.prf');

  if (fs.existsSync(prfPath)) {
    try {
      const content = fs.readFileSync(prfPath, 'utf-8');
      return parseFreeflightPrf(content);
    } catch (err) {
      logger.launcher.warn('Failed to read existing Freeflight.prf, creating new', err);
    }
  }

  return { globals: new Map(), perItem: new Map() };
}

// ============================================================================
// Serializer
// ============================================================================

/**
 * Serialize FreeflightPrf structure back to file format
 */
function serializeFreeflightPrf(prf: FreeflightPrf): string {
  const lines: string[] = [];

  // Header
  lines.push('I');
  lines.push('1100 Version');

  // Global settings in preferred order
  const globalOrder = [
    '_default_to_ramps',
    '_airport',
    '_last_start',
    '_other_aircraft',
    '_time',
    '_aircraft',
    '_wxr_def',
    '_wxr_use_rvr',
  ];

  // Write ordered globals first
  for (const key of globalOrder) {
    if (prf.globals.has(key)) {
      const value = prf.globals.get(key)!;
      lines.push(`${key} ${value}`);
    }
  }

  // Write any remaining globals not in our order
  for (const [key, value] of prf.globals) {
    if (!globalOrder.includes(key)) {
      lines.push(`${key} ${value}`);
    }
  }

  // Blank line before per-item settings
  lines.push('');

  // Per-item settings
  for (const [key, value] of prf.perItem) {
    if (value) {
      lines.push(`${key} ${value}`);
    } else {
      lines.push(key);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Updater
// ============================================================================

/**
 * Update FreeflightPrf with launch config, preserving existing settings
 */
function updatePrfWithConfig(
  prf: FreeflightPrf,
  config: LaunchConfig,
  aircraftKey: string
): FreeflightPrf {
  const { globals, perItem } = prf;
  const icao = config.startPosition.airport;
  const isRamp = config.startPosition.type === 'ramp';

  // Update global settings
  globals.set('_default_to_ramps', isRamp ? '1' : '0');
  globals.set('_airport', icao);
  globals.set('_last_start', generateStartPositionJson(config.startPosition));
  globals.set('_other_aircraft', '{"ai_aircraft":null}');
  globals.set('_time', generateTimeJson(config.time));
  globals.set('_aircraft', config.aircraft.path);
  globals.set('_wxr_def', config.weather?.definition || DEFAULT_WEATHER_DEFINITION);
  globals.set('_wxr_use_rvr', '0');

  // Update per-item settings (only for current aircraft/airport)
  perItem.set(`P _weight_and_balance ${aircraftKey}`, generateWeightJson(config.fuel));
  perItem.set(`P _livery ${aircraftKey}`, config.livery);
  perItem.set(`P _start_is_rwy ${icao}`, isRamp ? '0' : '1');

  if (config.startPosition.xplaneIndex === undefined) {
    throw new Error(
      `Missing xplaneIndex for start position "${config.startPosition.position}" - this is required for correct X-Plane spawning`
    );
  }
  perItem.set(`P _rwy_or_ramp ${icao}`, String(config.startPosition.xplaneIndex));

  return { globals, perItem };
}

// ============================================================================
// JSON Generators
// ============================================================================

function generateStartPositionJson(startPosition: StartPositionConfig): string {
  if (startPosition.type === 'ramp') {
    return JSON.stringify({
      ramp_start: {
        airport_id: startPosition.airport,
        ramp: startPosition.position,
      },
    });
  }
  // Runways and helipads both use runway_start
  return JSON.stringify({
    runway_start: {
      airport_id: startPosition.airport,
      runway: startPosition.position,
    },
  });
}

function generateTimeJson(time: TimeConfig): string {
  return JSON.stringify({
    local_time: {
      day_of_year: time.dayOfYear,
      latitude: time.latitude,
      longitude: time.longitude,
      time_in_24_hours: time.timeInHours,
    },
  });
}

function generateWeightJson(fuel: FuelConfig): string {
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

// ============================================================================
// Public API
// ============================================================================

/**
 * Generate Freeflight.prf content, preserving existing user preferences
 */
export function generateFreeflightPrf(config: LaunchConfig, xplanePath?: string): string {
  const aircraftKey = generateAircraftKey(config.aircraft.path);

  // Read existing preferences or start fresh
  const existingPrf = xplanePath
    ? readExistingPrf(xplanePath)
    : { globals: new Map(), perItem: new Map() };

  // Update with new config
  const updatedPrf = updatePrfWithConfig(existingPrf, config, aircraftKey);

  // Serialize back to string
  return serializeFreeflightPrf(updatedPrf);
}

/**
 * Write Freeflight.prf to X-Plane preferences folder
 */
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

/**
 * Calculate fuel tank weights from percentage
 */
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

/**
 * Get current day of year (1-365)
 */
export function getCurrentDayOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Get current time in hours (0-24)
 */
export function getCurrentTimeInHours(): number {
  const now = new Date();
  return now.getHours() + now.getMinutes() / 60;
}
