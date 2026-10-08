import { useQuery } from '@tanstack/react-query';
import type { NatFeed } from '@/lib/flightplan/builder/types';

const TRACKS_STALE_MS = 10 * 60 * 1000;

/** The North Atlantic track messages with geometry, refreshed every few minutes while wanted. */
export function useOceanicTracks(enabled: boolean) {
  return useQuery({
    queryKey: ['oceanic-tracks'],
    enabled,
    staleTime: TRACKS_STALE_MS,
    refetchInterval: TRACKS_STALE_MS,
    queryFn: async (): Promise<NatFeed> => window.flightPlanAPI.oceanicTracks(),
  });
}
