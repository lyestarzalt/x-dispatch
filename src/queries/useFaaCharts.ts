import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FaaChartSettings } from '@/lib/xplaneServices/dataService/navdata/faaChartIndexLoader';
import { appKeys } from './useAppQuery';

export const faaChartKeys = {
  status: ['nav', 'faaCharts'] as const,
};

/**
 * The FAA chart list behind the US procedure labels: where it comes from, its cycle, and the
 * download switch. Refreshes when a download finishes.
 */
export function useFaaChartStatus() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      window.navAPI.onFaaChartsUpdated(() => {
        void queryClient.invalidateQueries({ queryKey: faaChartKeys.status });
      }),
    [queryClient]
  );
  return useQuery({
    queryKey: faaChartKeys.status,
    queryFn: () => window.navAPI.getFaaChartStatus(),
  });
}

function useFaaChartMutation<T>(mutationFn: (arg: T) => Promise<FaaChartSettings>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (status) => {
      queryClient.setQueryData(faaChartKeys.status, status);
      // Labels come and go with the list, so procedures already open are read again.
      void queryClient.invalidateQueries({ queryKey: appKeys.allProcedures });
    },
  });
}

export function useSetFaaChartDownload() {
  return useFaaChartMutation((enabled: boolean) => window.navAPI.setFaaChartDownload(enabled));
}

export function useDownloadFaaCharts() {
  return useFaaChartMutation(() => window.navAPI.downloadFaaCharts());
}
