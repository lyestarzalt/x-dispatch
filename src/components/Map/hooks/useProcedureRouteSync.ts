import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { addProcedureRouteLayer, removeProcedureRouteLayer } from '../layers';
import type { MapRef } from './useMapSetup';

interface UseProcedureRouteSyncOptions {
  mapRef: MapRef;
  styleVersion: number;
}

/**
 * Syncs the selected procedure from appStore to the map layer.
 * Automatically adds/removes the procedure route layer when selection changes.
 */
export function useProcedureRouteSync({
  mapRef,
  styleVersion,
}: UseProcedureRouteSyncOptions): void {
  const selectedProcedure = useAppStore((s) => s.selectedProcedure);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedProcedure) {
      removeProcedureRouteLayer(map);
      return;
    }

    // Wait for style to be loaded before adding layers
    if (!map.isStyleLoaded()) {
      return;
    }

    addProcedureRouteLayer(map, {
      type: selectedProcedure.type as 'SID' | 'STAR' | 'APPROACH',
      name: selectedProcedure.name,
      waypoints: selectedProcedure.waypoints.map((wp) => ({
        fixId: wp.fixId,
        latitude: wp.latitude,
        longitude: wp.longitude,
        resolved: wp.resolved,
      })),
    });

    return () => {
      // Use captured map reference for cleanup
      removeProcedureRouteLayer(map);
    };
  }, [mapRef, selectedProcedure, styleVersion]);
}
