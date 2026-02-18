import { useQuery } from '@tanstack/react-query';
import type { Aircraft, WeatherPreset } from '@/types/aircraft';

export const launchKeys = {
  all: ['launch'] as const,
  aircraftList: ['launch', 'aircraftList'] as const,
  weatherPresets: ['launch', 'weatherPresets'] as const,
  aircraftImage: (path: string) => ['launch', 'aircraftImage', path] as const,
};

export function useAircraftList(enabled: boolean = true) {
  return useQuery({
    queryKey: launchKeys.aircraftList,
    queryFn: async (): Promise<Aircraft[]> => {
      const cached = await window.launcherAPI.getAircraft();
      if (cached.length > 0) return cached;
      const result = await window.launcherAPI.scanAircraft();
      return result.success ? result.aircraft : [];
    },
    enabled,
    staleTime: Infinity,
  });
}

export function useWeatherPresets(enabled: boolean = true) {
  return useQuery({
    queryKey: launchKeys.weatherPresets,
    queryFn: (): Promise<WeatherPreset[]> => window.launcherAPI.getWeatherPresets(),
    enabled,
    staleTime: Infinity,
  });
}

export function useAircraftImage(imagePath: string | null) {
  return useQuery({
    queryKey: launchKeys.aircraftImage(imagePath ?? ''),
    queryFn: () => window.launcherAPI.getAircraftImage(imagePath!),
    enabled: !!imagePath,
    staleTime: Infinity,
  });
}
