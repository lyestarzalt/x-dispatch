import { useQuery } from '@tanstack/react-query';
import type { OceanicTrackInfo } from '@/lib/flightplan/builder/types';

const TRACKS_STALE_MS = 10 * 60 * 1000;

/** The current North Atlantic tracks with geometry, refreshed every few minutes while wanted. */
export function useOceanicTracks(enabled: boolean) {
  return useQuery({
    queryKey: ['oceanic-tracks'],
    enabled,
    staleTime: TRACKS_STALE_MS,
    refetchInterval: TRACKS_STALE_MS,
    queryFn: async (): Promise<OceanicTrackInfo[]> => window.flightPlanAPI.oceanicTracks(),
  });
}
