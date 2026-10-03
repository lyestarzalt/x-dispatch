import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import { type PlanFix, addProcedureRouteLayer, removeProcedureRouteLayer } from '../layers';
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

    // Wait for style to be loaded before adding layers
    if (!map.isStyleLoaded()) {
      map.once('styledata', addLayer);
      return () => {
        map.off('styledata', addLayer);
        removeProcedureRouteLayer(map);
      };
    }

    addLayer();

    return () => {
      // Use captured map reference for cleanup
      removeProcedureRouteLayer(map);
    };
  }, [mapRef, selectedProcedure, fmsData]);
}
