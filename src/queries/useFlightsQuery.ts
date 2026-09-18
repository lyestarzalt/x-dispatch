import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFlightRecorderStore } from '@/stores/flightRecorderStore';
import { useSettingsStore } from '@/stores/settingsStore';

export const flightKeys = {
  all: ['flights'] as const,
  list: ['flights', 'list'] as const,
  detail: (id: string) => ['flights', 'detail', id] as const,
};

export function useFlightsQuery(enabled = true) {
  return useQuery({
    queryKey: flightKeys.list,
    queryFn: () => window.flightsAPI.list(),
    enabled,
    staleTime: 30_000,
  });
}

export function useFlightDetailQuery(id: string | null) {
  return useQuery({
    queryKey: flightKeys.detail(id ?? ''),
    queryFn: () => window.flightsAPI.get(id!),
    enabled: id !== null,
    staleTime: 10_000,
  });
}

export function useDeleteFlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => window.flightsAPI.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: flightKeys.all }),
  });
}

export function useClearFlights() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => window.flightsAPI.clear(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: flightKeys.all }),
  });
}

/**
 * Keeps the renderer's recorder mirror in sync with the main process and
 * refreshes the logbook when a flight changes. Mount once, next to the
 * plane state stream.
 */
export function useFlightRecorderStream(): void {
  const queryClient = useQueryClient();
  const recording = useSettingsStore((s) => s.flights.recording);

  useEffect(() => {
    void window.flightsAPI.setEnabled(recording);
  }, [recording]);

  useEffect(() => {
    const { setLive, applyEvent } = useFlightRecorderStore.getState();
    let cancelled = false;
    void window.flightsAPI.liveState().then((live) => {
      if (!cancelled) setLive(live);
    });
    const unsubscribe = window.flightsAPI.onEvent((event) => {
      applyEvent(event);
      if (event.type !== 'track' && event.type !== 'phase') {
        void queryClient.invalidateQueries({ queryKey: flightKeys.all });
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [queryClient]);
}
