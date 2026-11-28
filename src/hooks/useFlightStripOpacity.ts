import { useEffect } from 'react';
import { listenOpacityWheel } from '@/lib/flightStrip/opacityWheel';
import { clampFlightStripOpacity } from '@/lib/flightStrip/windowOptions';
import { useSettingsStore } from '@/stores/settingsStore';

type Panel = 'strip' | 'map';

function adjustOpacity(panel: Panel, delta: number) {
  const { flightStrip, setFlightStripOpacity, updateFlightStripSettings } =
    useSettingsStore.getState();
  if (panel === 'strip') setFlightStripOpacity(flightStrip.opacity + delta);
  else
    updateFlightStripSettings({
      taxiMapOpacity: clampFlightStripOpacity(flightStrip.taxiMapOpacity + delta),
    });
}

/** The main renderer owns settings. Detached panels send deltas and follow the existing storage sync. */
export function useFlightStripOpacity(detached: boolean) {
  useEffect(() => {
    const channel = new BroadcastChannel('x-dispatch-strip-opacity');
    if (!detached)
      channel.onmessage = ({ data }) => {
        if (
          (data?.panel === 'map' || data?.panel === 'strip') &&
          Number.isFinite(data.delta) &&
          Math.abs(data.delta) <= 0.1
        )
          adjustOpacity(data.panel, data.delta);
      };
    const remove = listenOpacityWheel(window, (event, delta) => {
      const target =
        event.target instanceof Element &&
        event.target.closest<HTMLElement>('[data-strip-opacity]');
      const panel = target && target.dataset.stripOpacity;
      if (panel !== 'map' && panel !== 'strip') return false;
      if (detached) channel.postMessage({ panel, delta });
      else adjustOpacity(panel, delta);
      return true;
    });
    return () => {
      remove();
      channel.close();
    };
  }, [detached]);
}
