/**
 * X-Plane TanStack Query Hooks
 *
 * Uses IPC to call X-Plane REST API from main process (avoids CORS).
 * Types from generated OpenAPI client at @/lib/xplaneServices/client/generated/xplaneApi.ts
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';

// Re-export types from generated client
export type {
  FlightInit,
  Dataref,
  Command,
  ApiCapabilities,
} from '@/lib/xplaneServices/client/generated/xplaneApi';

// Query keys
export const xplaneKeys = {
  all: ['xplane'] as const,
  status: ['xplane', 'status'] as const,
  capabilities: ['xplane', 'capabilities'] as const,
  dataref: (name: string) => ['xplane', 'dataref', name] as const,
};

/**
 * Check if X-Plane API is available (running)
 */
export function useXPlaneStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  const { enabled = true, refetchInterval = 5000 } = options ?? {};

  return useQuery({
    queryKey: xplaneKeys.status,
    queryFn: () => window.xplaneServiceAPI.isAPIAvailable(),
    enabled,
    staleTime: refetchInterval - 1000,
    refetchInterval: enabled ? refetchInterval : false,
  });
}

/**
 * Get X-Plane and API version info
 */
export function useXPlaneCapabilities(options?: { enabled?: boolean }) {
  const { enabled = true } = options ?? {};

  return useQuery({
    queryKey: xplaneKeys.capabilities,
    queryFn: () => window.xplaneServiceAPI.getCapabilities(),
    enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Get a dataref value by name
 */
export function useDataref(
  datarefName: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  const { enabled = true, refetchInterval } = options ?? {};

  return useQuery({
    queryKey: xplaneKeys.dataref(datarefName),
    queryFn: () => window.xplaneServiceAPI.getDataref(datarefName),
    enabled: enabled && datarefName.length > 0,
    refetchInterval,
  });
}

/**
 * Set a dataref value
 */
export function useSetDataref() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ datarefName, value }: { datarefName: string; value: number | number[] }) =>
      window.xplaneServiceAPI.setDataref(datarefName, value),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: xplaneKeys.dataref(variables.datarefName) });
    },
  });
}

/**
 * Activate a command
 */
export function useActivateCommand() {
  return useMutation({
    mutationFn: ({ commandName, duration = 0 }: { commandName: string; duration?: number }) =>
      window.xplaneServiceAPI.activateCommand(commandName, duration),
  });
}

/**
 * Start a new flight
 */
export function useStartFlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (flightConfig: FlightInit) => window.xplaneServiceAPI.startFlight(flightConfig),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: xplaneKeys.status });
    },
  });
}
