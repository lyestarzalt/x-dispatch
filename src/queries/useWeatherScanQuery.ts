import { useQuery } from '@tanstack/react-query';
import {
  type MetarObservation,
  type WeatherCategory,
  parseMetarFeed,
} from '@/lib/weatherScan/parseMetarFeed';

export type { MetarObservation, WeatherCategory };

const weatherScanKeys = {
  all: ['weather-scan'] as const,
};

async function fetchWeatherScan(): Promise<MetarObservation[]> {
  const response = await window.airportAPI.fetchVatsimMetarsAll();
  if (!response.data || response.error) {
    throw new Error(response.error || 'Failed to fetch VATSIM METAR feed');
  }
  return parseMetarFeed(response.data);
}

/**
 * Live weather scan across every station VATSIM publishes a METAR for.
 *
 * The feed is roughly 700KB and individual stations report about hourly, so
 * this refreshes far less often than the traffic feeds.
 */
export function useWeatherScanQuery(enabled: boolean = true) {
  return useQuery({
    queryKey: weatherScanKeys.all,
    queryFn: fetchWeatherScan,
    enabled,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchInterval: enabled ? 10 * 60 * 1000 : false,
  });
}

export const WEATHER_CATEGORIES: WeatherCategory[] = [
  'snow',
  'freezing',
  'fog',
  'lowVisibility',
  'lowCeiling',
  'heavyPrecipitation',
  'thunderstorm',
  'severe',
  'dustSand',
  'strongWind',
  'clear',
];

/**
 * Rank observations so the most flyable-interesting sit at the top: worst
 * visibility first, then whatever is left ordered by how recent it is.
 */
export function sortBySeverity(observations: MetarObservation[]): MetarObservation[] {
  return [...observations].sort((a, b) => {
    const visA = a.visibilityMetres ?? Number.POSITIVE_INFINITY;
    const visB = b.visibilityMetres ?? Number.POSITIVE_INFINITY;
    if (visA !== visB) return visA - visB;
    return a.ageMinutes - b.ageMinutes;
  });
}

export function filterByCategory(
  observations: MetarObservation[] | undefined,
  category: WeatherCategory
): MetarObservation[] {
  if (!observations) return [];
  return sortBySeverity(observations.filter((o) => o.categories.includes(category)));
}
