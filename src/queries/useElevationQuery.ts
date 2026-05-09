import { useQuery } from '@tanstack/react-query';

/**
 * Whether the running X-Dispatch process is elevated.
 * Process-lifetime constant, so a single fetch with `staleTime: Infinity`
 * is enough — no refetching needed.
 */
export function useElevationQuery() {
  return useQuery({
    queryKey: ['app', 'isElevated'],
    queryFn: () => window.companionAppsAPI.isElevated(),
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
