import { useQuery } from '@tanstack/react-query';
import type { XPLogReadResult } from '@/lib/xplaneServices/log/ipc';

export type { XPLogReadResult };

export const xplaneLogKeys = {
  all: ['xplane-log'] as const,
  read: ['xplane-log', 'read'] as const,
};

export function useXplaneLogQuery(enabled: boolean) {
  return useQuery<XPLogReadResult>({
    queryKey: xplaneLogKeys.read,
    queryFn: () => window.xpLogAPI.read(),
    enabled,
    staleTime: 0,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
