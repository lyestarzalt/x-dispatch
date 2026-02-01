import { useQuery } from '@tanstack/react-query';
import { DecodedMETAR, decodeMetar } from '@/utils/decodeMetar';

export interface WeatherData {
  metar: {
    raw: string;
    decoded: DecodedMETAR;
  } | null;
  taf: string | null;
}

export const weatherKeys = {
  all: ['weather'] as const,
  metar: (icao: string) => ['weather', 'metar', icao.toUpperCase()] as const,
  taf: (icao: string) => ['weather', 'taf', icao.toUpperCase()] as const,
  combined: (icao: string) => ['weather', 'combined', icao.toUpperCase()] as const,
};

async function fetchMetar(icao: string): Promise<{ raw: string; decoded: DecodedMETAR } | null> {
  try {
    const response = await window.airportAPI.fetchMetar(icao);
    if (!response.data || response.error) return null;
    return { raw: response.data, decoded: decodeMetar(response.data) };
  } catch {
    return null;
  }
}

async function fetchTaf(icao: string): Promise<string | null> {
  try {
    const response = await window.airportAPI.fetchTaf(icao);
    if (!response.data || response.error) return null;
    return response.data;
  } catch {
    return null;
  }
}

async function fetchWeatherData(icao: string): Promise<WeatherData> {
  const [metar, taf] = await Promise.all([fetchMetar(icao), fetchTaf(icao)]);
  return { metar, taf };
}

export function useMetarQuery(icao: string | null) {
  return useQuery({
    queryKey: weatherKeys.metar(icao ?? ''),
    queryFn: () => fetchMetar(icao!),
    enabled: !!icao,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

export function useTafQuery(icao: string | null) {
  return useQuery({
    queryKey: weatherKeys.taf(icao ?? ''),
    queryFn: () => fetchTaf(icao!),
    enabled: !!icao,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

export function useWeatherQuery(icao: string | null) {
  return useQuery({
    queryKey: weatherKeys.combined(icao ?? ''),
    queryFn: () => fetchWeatherData(icao!),
    enabled: !!icao,
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}
