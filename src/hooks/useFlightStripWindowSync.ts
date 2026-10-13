import { useEffect } from 'react';
import type { FlightStripWindowOptions } from '@/lib/flightStrip/windowOptions';
import type { GuidanceRoutes } from '@/lib/taxiGuidance/windowRoutes';
import { usePlaneStore } from '@/stores/planeStore';
import { type FlightStripSettings, useSettingsStore } from '@/stores/settingsStore';
import { useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';

function windowOptions(settings: FlightStripSettings): FlightStripWindowOptions {
  return {
    locked: settings.locked,
    opacity: settings.opacity,
    alwaysOnTop: settings.alwaysOnTop,
  };
}

/**
 * Main window only. The strip window lives in its own renderer, so main relays its
 * window settings and the planned taxi routes; and with auto-open on, the strip
 * opens when X-Plane connects.
 */
export function useFlightStripWindowSync(): void {
  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    const push = (settings: FlightStripSettings) =>
      window.appAPI.setFlightStripWindowOptions(windowOptions(settings));
    push(useSettingsStore.getState().flightStrip);
    return useSettingsStore.subscribe((state, previous) => {
      const next = state.flightStrip;
      const prev = previous.flightStrip;
      if (
        next.locked !== prev.locked ||
        next.opacity !== prev.opacity ||
        next.alwaysOnTop !== prev.alwaysOnTop
      ) {
        push(next);
      }
    });
  }, []);

  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    const push = ({ departure, arrival }: GuidanceRoutes) =>
      window.appAPI.setFlightStripGuidance({ departure, arrival });
    push(useTaxiGuidanceStore.getState());
    return useTaxiGuidanceStore.subscribe((state, previous) => {
      if (state.departure !== previous.departure || state.arrival !== previous.arrival) {
        push(state);
      }
    });
  }, []);

  useEffect(() => {
    if (window.appAPI.isRemoteClient) return;
    return usePlaneStore.subscribe((state, previous) => {
      if (!state.connected || previous.connected) return;
      if (useSettingsStore.getState().flightStrip.autoOpen) {
        void window.appAPI.showFlightStripWindow();
      }
    });
  }, []);
}
