export interface Aircraft {
  path: string;
  name: string;
  manufacturer: string;
  studio: string;
  author: string;
  tailNumber: string;
  emptyWeight: number;
  maxWeight: number;
  maxFuel: number;
  tankNames: string[];
  previewImage: string | null;
  thumbnailImage: string | null;
  liveries: Livery[];
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
