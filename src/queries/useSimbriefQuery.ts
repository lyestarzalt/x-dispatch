import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { analyticsFmsFormat } from '@/lib/analytics/buckets';
import { parseDurationSeconds } from '@/lib/simbrief/ofp';
import type { SimBriefErrorCode, SimBriefOFP } from '@/types/simbrief';
import { trackEvent } from './useAnalytics';

export const simbriefKeys = {
  all: ['simbrief'] as const,
  latest: (pilotId: string) => ['simbrief', 'latest', pilotId] as const,
};

/** A failed fetch, with the code the UI translates. */
export class SimbriefFetchError extends Error {
  constructor(
    readonly code: SimBriefErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'SimbriefFetchError';
  }
}

/** The main process parses, trims and normalises the OFP; the renderer only reads it. */
async function fetchSimbrief(user: string): Promise<SimBriefOFP> {
  const response = await window.simbriefAPI.fetchLatest(user);
  if (!response.success) {
    throw new SimbriefFetchError(response.code, response.error);
  }
  return response.data;
}

/**
 * Query for fetching SimBrief flight plan (with caching)
 * Use this when you want automatic caching and refetching
 */
export function useSimbriefQuery(pilotId: string, enabled = false) {
  return useQuery({
    queryKey: simbriefKeys.latest(pilotId),
    queryFn: () => fetchSimbrief(pilotId),
    enabled: !!pilotId && enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
}

/**
 * Mutation for manual fetch (import button)
 * Use this for explicit user-triggered fetches. The Settings test button passes
 * `track: false` so a connection check does not count as an import.
 */
export function useSimbriefFetch({ track = true }: { track?: boolean } = {}) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchSimbrief,
    onSuccess: (data, user) => {
      queryClient.setQueryData(simbriefKeys.latest(user), data);
      if (track) trackEvent('simbrief_imported', {});
    },
  });
}

/**
 * Mutation for downloading a SimBrief-generated FMS file to a configured target folder.
 * Call once per (target, OFP) pair. No caching — each click is a fresh download.
 */
export function useDownloadFmsFile() {
  return useMutation({
    mutationFn: ({
      format: _format,
      ...args
    }: {
      url: string;
      targetDir: string;
      filename: string;
      /** SimBrief download key, for usage stats only. */
      format: string;
    }) => window.simbriefAPI.downloadFmsFile(args),
    onSuccess: (result, { format }) => {
      if (result.success) trackEvent('fms_exported', { format: analyticsFmsFormat(format) });
    },
  });
}

/**
 * Get route coordinates from SimBrief data
 */
export function getRouteCoordinates(data: SimBriefOFP): [number, number][] {
  return data.navlog.map((fix) => [parseFloat(fix.pos_long), parseFloat(fix.pos_lat)]);
}

/**
 * Format a SimBrief duration ("13:17:31", or seconds) as "13h 17m".
 */
export function formatFlightTime(duration: string | number): string {
  const secs = parseDurationSeconds(duration);
  if (secs === null) return '—';
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  return `${hours}h ${mins}m`;
}
