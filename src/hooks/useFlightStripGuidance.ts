import { useEffect } from 'react';
import { useTaxiGuidanceStore } from '@/stores/taxiGuidanceStore';

/**
 * Strip window only: follows the taxi routes the main window planned. Main hands
 * over the current routes when the window opens and every change after.
 */
export function useFlightStripGuidance(): void {
  useEffect(() => {
    const { setRoutes } = useTaxiGuidanceStore.getState();
    let live = true;
    const unsubscribe = window.appAPI.onFlightStripGuidance(setRoutes);
    void window.appAPI.getFlightStripGuidance().then((routes) => {
      if (live) setRoutes(routes);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);
}
