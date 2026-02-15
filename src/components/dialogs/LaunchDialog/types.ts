import type { Aircraft } from '@/lib/launcher/types';

// Import types from canonical source
export type { Aircraft, Livery, WeatherPreset } from '@/lib/launcher/types';

export type AircraftType = 'all' | 'fixed-wing' | 'helicopter';
export type EngineType = 'all' | 'jet' | 'prop';
type EngineCount = 'all' | 'single' | 'multi';

export function getAircraftType(ac: Aircraft): 'helicopter' | 'fixed-wing' {
  return ac.isHelicopter ? 'helicopter' : 'fixed-wing';
}

export function getEngineType(ac: Aircraft): 'jet' | 'prop' {
  return ac.propCount === 0 ? 'jet' : 'prop';
}

function getEngineCount(ac: Aircraft): EngineCount {
  return ac.engineCount > 1 ? 'multi' : 'single';
}

// Re-export from shared types
export type { StartPosition } from '@/types/position';

interface FlightConfig {
  timeOfDay: number;
  weather: string;
  fuelPercentage: number;
}

export const WEATHER_OPTIONS = [
  'real',
  'clear',
  'cloudy',
  'rainy',
  'stormy',
  'snowy',
  'foggy',
] as const;

type WeatherOption = (typeof WEATHER_OPTIONS)[number];

const FAVORITES_KEY = 'xplane-launcher-favorites';

export function getFavorites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveFavorites(favorites: string[]) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
}

export function getCategory(path: string): string {
  const parts = path.split('/');
  if (parts.length >= 2) return parts[1];
  return 'Other';
}
