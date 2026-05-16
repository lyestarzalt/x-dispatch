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

export type ComRadio = 'COM1' | 'COM2';
export type ComSlot = 'active' | 'standby';

// X-Plane 12 8.33-kHz capable datarefs. All take an int in kHz
// (e.g. 124850 for 124.850 MHz). Available since X-Plane 10.30.
const COM_DATAREF: Record<ComRadio, Record<ComSlot, string>> = {
  COM1: {
    active: 'sim/cockpit2/radios/actuators/com1_frequency_hz_833',
    standby: 'sim/cockpit2/radios/actuators/com1_standby_frequency_hz_833',
  },
  COM2: {
    active: 'sim/cockpit2/radios/actuators/com2_frequency_hz_833',
    standby: 'sim/cockpit2/radios/actuators/com2_standby_frequency_hz_833',
  },
};

/**
 * Parse a display frequency like "124.850" into the int kHz form
 * X-Plane's *_hz_833 datarefs expect (124850). Returns null if the
 * input doesn't look like a valid MHz frequency.
 */
export function freqStringToKhz(freq: string): number | null {
  const trimmed = freq.trim();
  if (!trimmed) return null;
  const mhz = Number.parseFloat(trimmed);
  if (!Number.isFinite(mhz)) return null;
  const khz = Math.round(mhz * 1000);
  // COM band is 118.000–136.975 MHz; reject anything outside it so we
  // never silently write garbage to the radio dataref.
  if (khz < 118_000 || khz > 137_000) return null;
  return khz;
}

/**
 * Tune one of the COM radios on the active aircraft.
 */
export function useTuneRadio() {
  return useMutation({
    mutationFn: async ({ radio, slot, freq }: { radio: ComRadio; slot: ComSlot; freq: string }) => {
      const khz = freqStringToKhz(freq);
      if (khz === null) {
        return { success: false as const, error: 'invalid_frequency' };
      }
      return window.xplaneServiceAPI.setDataref(COM_DATAREF[radio][slot], khz);
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
