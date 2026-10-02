import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import type { MapRef } from './useMapSetup';

/**
 * Publishes the right-clicked map point to the store for `MapContextMenu`.
 *
 * Listens to MapLibre's own `contextmenu` event rather than the DOM one:
 * MapLibre defers it to mouse-up and drops it when the right button was used
 * to drag-rotate, on both macOS (where the DOM event fires on mouse-down)
 * and Windows.
 *
 * Call this from the component that owns the map, after `useMapSetup`, so
 * the effect runs once the map exists. A child widget's mount effect runs
 * before the parent's map-creating effect and would see a null ref forever.
 */
export function useMapContextMenu(mapRef: MapRef): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setContextMenuPoint = useMapStore.getState().setContextMenuPoint;

    const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
      const elev = map.getTerrain() ? map.queryTerrainElevation(e.lngLat) : null;
      setContextMenuPoint({
        longitude: e.lngLat.lng,
        latitude: e.lngLat.lat,
        x: e.point.x,
        y: e.point.y,
        elevationM: typeof elev === 'number' && Number.isFinite(elev) ? elev : null,
      });
    };
    const close = () => {
      if (useMapStore.getState().contextMenuPoint) setContextMenuPoint(null);
    };

    map.on('contextmenu', handleContextMenu);
    map.on('movestart', close);
    return () => {
      map.off('contextmenu', handleContextMenu);
      map.off('movestart', close);
      close();
    };
  }, [mapRef]);
}
