import { useQuery } from '@tanstack/react-query';
import { runwayEndsFromApt } from '@/lib/flightplan/builder/runways';
import type { RunwayEnd } from '@/types/fms';

/** Land runway ends for an airport, read from its apt.dat block. Empty for heliports. */
export function useAirportRunways(icao: string | null) {
  return useQuery({
    queryKey: ['airport-runways', icao],
    enabled: icao !== null,
    staleTime: Infinity,
    queryFn: async (): Promise<RunwayEnd[]> => {
      if (!icao) return [];
      const result = (await window.airportAPI.getAirportData(icao)) as { data?: unknown } | null;
      return typeof result?.data === 'string' ? runwayEndsFromApt(result.data) : [];
    },
  });
}
