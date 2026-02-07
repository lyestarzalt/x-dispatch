import { useEffect } from 'react';
import type { Airport } from '@/lib/xplaneData';
import { useMapStore } from '@/stores/mapStore';
import { addRouteLineLayer, removeRouteLineLayer, updateRouteLine } from '../layers';
import type { MapRef } from './useMapSetup';

interface UseRouteLineSyncOptions {
  mapRef: MapRef;
  airports: Airport[];
}

export function useRouteLineSync({ mapRef, airports }: UseRouteLineSyncOptions): void {
  const selectedRoute = useMapStore((s) => s.explore.selectedRoute);

  // Initialize route line layer on map load
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const initLayer = () => {
      addRouteLineLayer(map);
    };

    if (map.isStyleLoaded()) {
      initLayer();
    } else {
      map.once('load', initLayer);
    }

    return () => {
      if (map && map.getStyle()) {
        removeRouteLineLayer(map);
      }
    };
  }, [mapRef]);

  // Update route line when selection changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedRoute) {
      updateRouteLine(map, null);
      return;
    }

    // Find airport coordinates
    const fromAirport = airports.find((a) => a.icao === selectedRoute.from);
    const toAirport = airports.find((a) => a.icao === selectedRoute.to);

    if (fromAirport && toAirport) {
      updateRouteLine(map, {
        from: [fromAirport.lon, fromAirport.lat],
        to: [toAirport.lon, toAirport.lat],
      });

      // Fit map to show both airports with padding
      const bounds = [
        [Math.min(fromAirport.lon, toAirport.lon), Math.min(fromAirport.lat, toAirport.lat)],
        [Math.max(fromAirport.lon, toAirport.lon), Math.max(fromAirport.lat, toAirport.lat)],
      ] as [[number, number], [number, number]];

      map.fitBounds(bounds, {
        padding: { top: 100, bottom: 100, left: 100, right: 100 },
        duration: 1500,
      });
    } else {
      updateRouteLine(map, null);
    }
  }, [mapRef, selectedRoute, airports]);
}
