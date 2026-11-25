import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FaaChartSettings } from '@/lib/xplaneServices/dataService/navdata/faaChartIndexLoader';
import type { FaaChartPdfError } from '@/lib/xplaneServices/dataService/navdata/faaChartPdf';
import { appKeys } from './useAppQuery';

export const faaChartKeys = {
  status: ['nav', 'faaCharts'] as const,
  airport: (icao: string | null) => ['nav', 'faaCharts', 'airport', icao] as const,
  // Apart from the list's keys: a new chart list does not make a PDF of the same address stale.
  pdf: (url: string | null) => ['nav', 'faaChartPdf', url] as const,
};

/** Reads the chart queries again when a download finishes or the list is cleared. */
function useFaaChartsUpdated() {
  const queryClient = useQueryClient();
  useEffect(
    () =>
      window.navAPI.onFaaChartsUpdated(() => {
        void queryClient.invalidateQueries({ queryKey: faaChartKeys.status });
      }),
    [queryClient]
  );
}

/** The FAA's charts for a US airport, each with its PDF link; null when it has none. */
export function useFaaAirportCharts(icao: string | null) {
  useFaaChartsUpdated();
  return useQuery({
    queryKey: faaChartKeys.airport(icao),
    queryFn: () => window.navAPI.getFaaCharts(icao ?? ''),
    enabled: !!icao,
    staleTime: Infinity,
  });
}

/**
 * The FAA chart list behind the US procedure labels: where it comes from, its cycle, and the
 * download switch. Refreshes when a download finishes.
 */
export function useFaaChartStatus() {
  useFaaChartsUpdated();
  return useQuery({
    queryKey: faaChartKeys.status,
    queryFn: () => window.navAPI.getFaaChartStatus(),
  });
}

/** One chart's PDF bytes, for laying the chart over the map; the main process keeps it on disk. */
export function useFaaChartPdf(url: string | null) {
  return useQuery({
    queryKey: faaChartKeys.pdf(url),
    queryFn: async (): Promise<{ pdf: Uint8Array } | { error: FaaChartPdfError }> => {
      const result = await window.navAPI.getFaaChartPdf(url ?? '');
      if ('error' in result) return result;
      return { pdf: Uint8Array.from(atob(result.pdf), (c) => c.charCodeAt(0)) };
    },
    enabled: !!url,
    staleTime: Infinity,
    // A failed download is tried again the next time the chart is asked for.
    gcTime: 0,
    retry: false,
  });
}

/** Asks for a chart's PDF again, after a download that failed. */
export function useRetryFaaChartPdf() {
  const queryClient = useQueryClient();
  return (url: string) => queryClient.invalidateQueries({ queryKey: faaChartKeys.pdf(url) });
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
