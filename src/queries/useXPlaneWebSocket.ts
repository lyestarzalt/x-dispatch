/**
 * X-Plane WebSocket Streaming Hooks
 * For live plane state updates via WebSocket (through Electron IPC)
 *
 * Note: WebSocket connections go through Electron main process
 * because renderer can't directly connect to local WebSocket.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PlaneState } from '@/types/xplane';

export interface PlanePosition {
  lat: number;
  lng: number;
  altitude: number;
  heading: number;
  groundspeed: number;
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
