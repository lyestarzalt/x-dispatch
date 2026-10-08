import { type QueryClient, queryOptions, useQuery } from '@tanstack/react-query';
import type { Airport } from '@/lib/xplaneServices/dataService';

export const airportsListQuery = queryOptions({
  queryKey: ['airports', 'list'] as const,
  queryFn: (): Promise<Airport[]> => window.airportAPI.getAirports(),
  staleTime: Infinity,
});

/** App.tsx loads the list anyway; seeding the cache spares a second multi-MB IPC copy. */
export function setAirportsList(client: QueryClient, airports: Airport[]) {
  client.setQueryData(airportsListQuery.queryKey, airports);
}

/**
 * Cached list of airports the active X-Plane installation knows about.
 * The renderer normally receives this via prop drilling from App.tsx, but
 * some surfaces (e.g. the Settings dialog) live outside that prop chain
 * and need the same data — this hook gives them shared access.
 */
export function useAirportsListQuery() {
  return useQuery(airportsListQuery);
}
