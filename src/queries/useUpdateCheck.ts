import { useQuery } from '@tanstack/react-query';

export type UpdateCheckResult = {
  latestVersion: string | null;
  available: boolean;
  url: string;
};

const updateKeys = {
  check: ['app', 'updateCheck'] as const,
};

export function useUpdateCheck() {
  return useQuery<UpdateCheckResult>({
    queryKey: updateKeys.check,
    queryFn: () => window.appAPI.checkForUpdate(),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });
}
