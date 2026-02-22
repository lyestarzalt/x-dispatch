import { useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import { type RouteWaypoint, addProcedureRouteLayer, removeProcedureRouteLayer } from '../layers';
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

    const addLayer = () => {
      // Safety check - map may have been destroyed while waiting
      if (!mapRef.current) return;

      try {
        addProcedureRouteLayer(map, {
          type: selectedProcedure.type as 'SID' | 'STAR' | 'APPROACH',
          name: selectedProcedure.name,
          waypoints: selectedProcedure.waypoints.map((wp) => ({
            fixId: wp.fixId,
            latitude: wp.latitude,
            longitude: wp.longitude,
            resolved: wp.resolved,
            altitude: wp.altitude as RouteWaypoint['altitude'],
            speed: wp.speed,
            pathTerminator: wp.pathTerminator,
            course: wp.course,
            distance: wp.distance,
            turnDirection: wp.turnDirection,
          })),
        });
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
  }, [mapRef, selectedProcedure, styleVersion]);
}
