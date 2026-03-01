import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SimBriefOFP } from '@/types/simbrief';

export const simbriefKeys = {
  all: ['simbrief'] as const,
  latest: (pilotId: string) => ['simbrief', 'latest', pilotId] as const,
};

/**
 * Recursively sanitize SimBrief API response.
 * The API returns empty objects `{}` instead of null for missing fields,
 * which crashes React when rendered as children. This converts them to undefined.
 */
function sanitize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize) as T;
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return undefined as T;
    const cleaned: Record<string, unknown> = {};
    for (const key of keys) {
      cleaned[key] = sanitize(obj[key]);
    }
    return cleaned as T;
  }
  return value;
}

async function fetchSimbrief(pilotId: string): Promise<SimBriefOFP> {
  const response = await window.simbriefAPI.fetchLatest(pilotId);
  if (!response.success) {
    throw new Error(response.error);
  }
  return sanitize(response.data);
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
 * Use this for explicit user-triggered fetches
 */
export function useSimbriefFetch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: fetchSimbrief,
    onSuccess: (data, pilotId) => {
      queryClient.setQueryData(simbriefKeys.latest(pilotId), data);
    },
  });
}

/**
 * Get route coordinates from SimBrief data
 */
export function getRouteCoordinates(data: SimBriefOFP): [number, number][] {
  return data.navlog.fix.map((fix) => [parseFloat(fix.pos_long), parseFloat(fix.pos_lat)]);
}

/**
 * Format flight time from seconds to human readable
 */
export function formatFlightTime(seconds: string | number): string {
  const secs = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds;
  const hours = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  return `${hours}h ${mins}m`;
}

/**
 * Format fuel value with unit
 * SimBrief API returns values already in the user's preferred units
 * The unit parameter should be from params.units ("lbs" or "kgs")
 */
export function formatFuel(value: string, apiUnit: string = 'lbs'): string {
  const num = parseInt(value, 10);
  const unitLabel = apiUnit === 'kgs' ? 'kg' : 'lbs';
  return `${num.toLocaleString()} ${unitLabel}`;
}

/**
 * Format weight value with unit
 * SimBrief API returns values already in the user's preferred units
 * The unit parameter should be from params.units ("lbs" or "kgs")
 */
export function formatWeight(value: string, apiUnit: string = 'lbs'): string {
  const num = parseInt(value, 10);
  const unitLabel = apiUnit === 'kgs' ? 'kg' : 'lbs';
  return `${num.toLocaleString()} ${unitLabel}`;
}

/**
 * Format distance in nautical miles
 */
export function formatDistance(nm: string): string {
  return `${parseInt(nm, 10).toLocaleString()} nm`;
}
