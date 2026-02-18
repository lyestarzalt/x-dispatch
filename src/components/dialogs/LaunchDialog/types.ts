import type { Aircraft } from '@/types/aircraft';

// Export types from canonical source
export type { Aircraft, Livery, WeatherPreset } from '@/types/aircraft';

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
  if (parts.length >= 2) return parts[1];
  return 'Other';
}
