/**
 * X-Plane WebSocket Streaming
 * Live plane state updates via WebSocket (through Electron IPC).
 *
 * Note: WebSocket connections go through Electron main process
 * because renderer can't directly connect to local WebSocket.
 */
import { useEffect } from 'react';
import { usePlaneStore } from '@/stores/planeStore';

/**
 * Starts the plane state stream while mounted and publishes every snapshot
 * to `usePlaneStore`. Mount once, in the component that owns the map. Read
 * the values with store selectors so a snapshot only re-renders subscribers.
 */
export function usePlaneStateStream(): void {
  useEffect(() => {
    const { setState, setConnected } = usePlaneStore.getState();

    window.xplaneServiceAPI.startStateStream();
    const unsubState = window.xplaneServiceAPI.onStateUpdate(setState);
    const unsubConnection = window.xplaneServiceAPI.onConnectionChange(setConnected);
    // Clear state only after grace period expires (fired by main process)
    const unsubStateClear = window.xplaneServiceAPI.onStateClear(() => setState(null));

    return () => {
      window.xplaneServiceAPI.stopStateStream();
      unsubState();
      unsubConnection();
      unsubStateClear();
    };
  }, []);
}
