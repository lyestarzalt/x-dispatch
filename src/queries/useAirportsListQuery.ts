import { useQuery } from '@tanstack/react-query';
import type { Airport } from '@/lib/xplaneServices/dataService';

const QUERY_KEY = ['airports', 'list'] as const;

/**
 * Cached list of airports the active X-Plane installation knows about.
 * The renderer normally receives this via prop drilling from App.tsx, but
 * some surfaces (e.g. the Settings dialog) live outside that prop chain
 * and need the same data — this hook gives them shared access.
 */
export function useAirportsListQuery() {
  return useQuery<Airport[]>({
    queryKey: QUERY_KEY,
    queryFn: () => window.airportAPI.getAirports(),
    staleTime: Infinity,
  });
}
