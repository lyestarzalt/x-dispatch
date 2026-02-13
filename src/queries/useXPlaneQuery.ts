/**
 * X-Plane TanStack Query Hooks
 * React hooks for X-Plane API communication
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PlanePosition, PlaneState } from '@/types/xplane';

// Query keys
const xplaneKeys = {
  all: ['xplane'] as const,
  status: ['xplane', 'status'] as const,
  dataref: (ref: string) => ['xplane', 'dataref', ref] as const,
};

/**
 * Check if X-Plane is currently running
 * Polls every 5 seconds by default
 */
export function useXPlaneStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  const { enabled = true, refetchInterval = 5000 } = options ?? {};

  return useQuery({
    queryKey: xplaneKeys.status,
    queryFn: () => window.xplaneServiceAPI.isRunning(),
    enabled,
    staleTime: refetchInterval - 1000,
    refetchInterval: enabled ? refetchInterval : false,
  });
}

/**
 * Load a new flight via the Web API (only works if X-Plane is running)
 */
export function useLoadFlight() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Record<string, unknown>) => window.xplaneServiceAPI.loadFlight(config),
    onSuccess: () => {
      // Invalidate status query to refresh
      queryClient.invalidateQueries({ queryKey: xplaneKeys.status });
    },
  });
}

/**
 * Get a dataref value from X-Plane
 */
export function useDataref(
  dataref: string,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  const { enabled = true, refetchInterval } = options ?? {};

  return useQuery({
    queryKey: xplaneKeys.dataref(dataref),
    queryFn: () => window.xplaneServiceAPI.getDataref(dataref),
    enabled: enabled && dataref.length > 0,
    refetchInterval,
  });
}

/**
 * Set a dataref value in X-Plane
 */
export function useSetDataref() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ dataref, value }: { dataref: string; value: number | number[] }) =>
      window.xplaneServiceAPI.setDataref(dataref, value),
    onSuccess: (_, variables) => {
      // Invalidate the specific dataref query
      queryClient.invalidateQueries({ queryKey: xplaneKeys.dataref(variables.dataref) });
    },
  });
}

/**
 * Live plane state streaming via WebSocket
 * Automatically connects when mounted and disconnects when unmounted
 */
export function usePlaneState() {
  const [state, setState] = useState<PlaneState | null>(null);
  const [connected, setConnected] = useState(false);
  const unsubscribeRef = useRef<{ state: (() => void) | null; connection: (() => void) | null }>({
    state: null,
    connection: null,
  });

  useEffect(() => {
    // Start streaming
    window.xplaneServiceAPI.startStateStream();

    // Subscribe to updates
    const unsubState = window.xplaneServiceAPI.onStateUpdate(setState);
    const unsubConnection = window.xplaneServiceAPI.onConnectionChange(setConnected);
    unsubscribeRef.current = { state: unsubState, connection: unsubConnection };

    return () => {
      // Stop streaming and unsubscribe
      window.xplaneServiceAPI.stopStateStream();
      unsubState();
      unsubConnection();
    };
  }, []);

  return { state, connected };
}

/**
 * Simplified plane position for map display
 */
export function usePlanePosition(): { connected: boolean; position: PlanePosition | null } {
  const { state, connected } = usePlaneState();

  const position: PlanePosition | null = state
    ? {
        lat: state.latitude,
        lng: state.longitude,
        altitude: state.altitudeMSL,
        heading: state.heading,
        groundspeed: state.groundspeed,
      }
    : null;

  return { connected, position };
}

/**
 * Connection-aware state streaming with manual control
 */
export function usePlaneStateManual() {
  const [state, setState] = useState<PlaneState | null>(null);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const unsubscribeRef = useRef<{ state: (() => void) | null; connection: (() => void) | null }>({
    state: null,
    connection: null,
  });

  const start = useCallback(() => {
    if (streaming) return;

    window.xplaneServiceAPI.startStateStream();
    unsubscribeRef.current.state = window.xplaneServiceAPI.onStateUpdate(setState);
    unsubscribeRef.current.connection = window.xplaneServiceAPI.onConnectionChange(setConnected);
    setStreaming(true);
  }, [streaming]);

  const stop = useCallback(() => {
    if (!streaming) return;

    window.xplaneServiceAPI.stopStateStream();
    unsubscribeRef.current.state?.();
    unsubscribeRef.current.connection?.();
    unsubscribeRef.current = { state: null, connection: null };
    setStreaming(false);
    setConnected(false);
    setState(null);
  }, [streaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streaming) {
        window.xplaneServiceAPI.stopStateStream();
        unsubscribeRef.current.state?.();
        unsubscribeRef.current.connection?.();
      }
    };
  }, [streaming]);

  return { state, connected, streaming, start, stop };
}

/**
 * Check WebSocket connection status
 */
export function useStreamConnectionStatus() {
  return useQuery({
    queryKey: ['xplane', 'streamConnected'],
    queryFn: () => window.xplaneServiceAPI.isStreamConnected(),
    refetchInterval: 1000,
  });
}
