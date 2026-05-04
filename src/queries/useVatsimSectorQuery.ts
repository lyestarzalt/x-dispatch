import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export const vatsimSectorKeys = {
  all: ['vatsim', 'sectors'] as const,
};

export function getVatsimSectorQueryOptions(enabled = false) {
  return {
    queryKey: vatsimSectorKeys.all,
    queryFn: () => window.vatsimSectorAPI.getData(),
    enabled,
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
  };
}

export function useVatsimSectorQuery(enabled = false) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    return window.vatsimSectorAPI.onUpdated(() => {
      queryClient.invalidateQueries({ queryKey: vatsimSectorKeys.all });
    });
  }, [enabled, queryClient]);

  return useQuery(getVatsimSectorQueryOptions(enabled));
}
