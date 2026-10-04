import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { type PlanFix, addProcedureRouteLayer, removeProcedureRouteLayer } from '../layers';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

interface UseProcedureRouteSyncOptions {
  mapRef: MapRef;
}

/**
 * Syncs the selected procedure from appStore to the map layer.
 * Automatically adds/removes the procedure route layer when selection changes.
 * Fixes the loaded flight plan already draws are left to the flight plan
 * layer so a shared fix is not labelled twice.
 */
export function useProcedureRouteSync({ mapRef }: UseProcedureRouteSyncOptions): void {
  const selectedProcedure = useAppStore((s) => s.selectedProcedure);
  const fmsData = useFlightPlanStore((s) => s.fmsData);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedProcedure) {
      removeProcedureRouteLayer(map);
      return;
    }

    const addLayer = () => {
      // Safety check - map may have been destroyed while waiting
      if (!mapRef.current) return;

      const planFixes: PlanFix[] =
        fmsData?.waypoints.map((wp) => ({
          id: wp.id,
          latitude: wp.latitude,
          longitude: wp.longitude,
        })) ?? [];

      try {
        addProcedureRouteLayer(
          map,
          {
            type: selectedProcedure.type,
            name: selectedProcedure.name,
            waypoints: selectedProcedure.waypoints,
          },
          undefined,
          { planFixes }
        );
      } catch (err) {
        window.appAPI?.log?.error?.('Failed to add procedure route layer', err);
      }
    };

    // isStyleLoaded() stays false while any source is still updating, which with a
    // connected aircraft is nearly always, and 'styledata' only fires on style edits.
    // The helper also accepts a style that has merely finished loading.
    const cancel = runWhenStyleIsReady(map, addLayer);

    return () => {
      cancel();
      removeProcedureRouteLayer(map);
    };
  }, [mapRef, selectedProcedure, fmsData]);
}
