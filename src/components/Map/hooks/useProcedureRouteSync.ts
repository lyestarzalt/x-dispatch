import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useFlightPlanStore } from '@/stores/flightPlanStore';
import {
  type PlanFix,
  type RouteWaypoint,
  addProcedureRouteLayer,
  removeProcedureRouteLayer,
} from '../layers';
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
  // Only a new selection moves the camera; a flight plan change re-renders in place.
  const lastFittedRef = useRef<typeof selectedProcedure>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedProcedure) {
      lastFittedRef.current = null;
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
          },
          undefined,
          { planFixes, fitBounds: selectedProcedure !== lastFittedRef.current }
        );
        lastFittedRef.current = selectedProcedure;
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
