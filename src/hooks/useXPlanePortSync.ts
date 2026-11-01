import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Main window only. Main owns the REST and WebSocket clients, so it learns the
 * configured X-Plane web API port from here, on start and on every change.
 */
export function useXPlanePortSync(): void {
  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    const push = (port: number) => void window.xplaneServiceAPI.setPort(port);
    push(useSettingsStore.getState().launcher.webApiPort);
    return useSettingsStore.subscribe((state, previous) => {
      if (state.launcher.webApiPort !== previous.launcher.webApiPort) {
        push(state.launcher.webApiPort);
      }
    });
  }, []);
}
