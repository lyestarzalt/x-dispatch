import { useQuery } from '@tanstack/react-query';

export const crashReportKeys = {
  id: ['crash-report', 'id'] as const,
};

/** The anonymous ID sent with crash reports, or null while they are off. */
export function useCrashReportId(enabled: boolean) {
  return useQuery({
    queryKey: crashReportKeys.id,
    queryFn: () => window.appAPI.getCrashReportId(),
    enabled,
    staleTime: Infinity,
  });
}
