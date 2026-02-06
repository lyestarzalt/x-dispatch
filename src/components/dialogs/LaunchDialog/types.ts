export interface Aircraft {
  path: string;
  name: string;
  icao: string;
  description: string;
  manufacturer: string;
  studio: string;
  author: string;
  tailNumber: string;
  // Weights (lbs)
  emptyWeight: number;
  maxWeight: number;
  maxFuel: number;
  tankNames: string[];
  // Aircraft type
  isHelicopter: boolean;
  engineCount: number;
  propCount: number; // 0 = jet
  // Speeds (knots)
  vneKts: number;
  vnoKts: number;
  // Images
  previewImage: string | null;
  thumbnailImage: string | null;
  liveries: Livery[];
}

export type AircraftType = 'all' | 'fixed-wing' | 'helicopter';
export type EngineType = 'all' | 'jet' | 'prop';
export type EngineCount = 'all' | 'single' | 'multi';

export function getAircraftType(ac: Aircraft): 'helicopter' | 'fixed-wing' {
  return ac.isHelicopter ? 'helicopter' : 'fixed-wing';
}

export function getEngineType(ac: Aircraft): 'jet' | 'prop' {
  return ac.propCount === 0 ? 'jet' : 'prop';
}

export function getEngineCount(ac: Aircraft): 'single' | 'multi' {
  return ac.engineCount > 1 ? 'multi' : 'single';
}

export interface Livery {
  name: string;
  displayName: string;
  previewImage: string | null;
}

export interface WeatherPreset {
  name: string;
  definition: string;
}

export interface StartPosition {
  type: 'runway' | 'ramp';
  name: string;
  airport: string;
  latitude: number;
  longitude: number;
}

interface FlightConfig {
  timeOfDay: number;
  weather: string;
  fuelPercentage: number;
}

export const WEATHER_OPTIONS = ['clear', 'cloudy', 'rainy', 'stormy', 'snowy', 'foggy'] as const;

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
