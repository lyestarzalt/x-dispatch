import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft } from '@/types/aircraft';
import type { StartPosition } from '@/types/position';
import type { WeatherConfig } from './weatherTypes';

// Export types from canonical source
export type { Aircraft, Livery, WeatherPreset } from '@/types/aircraft';

export interface LogbookEntry {
  id: string;
  launchedAt: string; // ISO 8601

  // Display data (for card rendering)
  airportICAO: string;
  airportName: string;
  aircraftName: string;
  aircraftICAO: string;
  livery: string;
  previewImagePath: string | null;
  positionName: string;
  positionType: 'runway' | 'ramp' | 'custom';
  weatherMode: 'real' | 'preset' | 'custom';
  weatherPreset: string;
  coldAndDark: boolean;

  // Store values (for restoring LaunchDialog UI)
  aircraftPath: string;
  startPosition: StartPosition;
  weatherConfig: WeatherConfig;
  tankPercentages: number[];
  payloadWeights: number[];
  timeOfDay: number;
  useRealWorldTime: boolean;

  // Full payload (for exact relaunch)
  flightInit: FlightInit;
}

export type AircraftType = 'all' | 'fixed-wing' | 'helicopter';
export type EngineType = 'all' | 'jet' | 'prop';

export function getAircraftType(ac: Aircraft): 'helicopter' | 'fixed-wing' {
  return ac.isHelicopter ? 'helicopter' : 'fixed-wing';
}

export function getEngineType(ac: Aircraft): 'jet' | 'prop' {
  return ac.propCount === 0 ? 'jet' : 'prop';
}

// Re-export from shared types
export type { StartPosition } from '@/types/position';

export const WEATHER_OPTIONS = [
  'real',
  'clear',
  'cloudy',
  'rainy',
  'stormy',
  'snowy',
  'foggy',
] as const;

export function getCategory(path: string): string {
  const parts = path.split('/');
  const category = parts[1];
  if (category) return category;
  return 'Other';
}
