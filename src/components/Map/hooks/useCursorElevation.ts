import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import type { MapRef } from './useMapSetup';

export type { CursorElevation } from '@/stores/mapStore';

/**
 * Tracks the terrain elevation under the user's cursor and whether terrain
 * is even available, and publishes both to the map store. Splitting the two
 * lets the UI keep its layout stable: the elevation row stays mounted while
 * terrain is on (showing a placeholder when the cursor leaves the map) and
 * only collapses when the projection or the user setting drops terrain.
 *
 * The screen-space cursor pixel is remembered across map moves so the value
 * stays current as the user pans/zooms with the cursor stationary.
 *
 * Call this from the component that owns the map so the effect runs after
 * the map exists; consumers read `cursorElevation` from the store.
 */
export function useCursorElevation(mapRef: MapRef): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const publish = useMapStore.getState().setCursorElevation;
    let cursorPixel: { x: number; y: number } | null = null;

    const recompute = () => {
      const supported = map.getTerrain() != null;
      if (!cursorPixel || !supported) {
        publish({ supported, valueM: null });
        return;
      }
      const lngLat = map.unproject([cursorPixel.x, cursorPixel.y]);
      const elev = map.queryTerrainElevation([lngLat.lng, lngLat.lat]);
      publish({
        supported,
        valueM: typeof elev === 'number' && Number.isFinite(elev) ? elev : null,
      });
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      cursorPixel = { x: e.point.x, y: e.point.y };
      recompute();
    };
    const handleMouseOut = () => {
      cursorPixel = null;
      recompute();
    };

    recompute();
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    map.on('move', recompute);
    map.on('terrain', recompute);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      map.off('move', recompute);
      map.off('terrain', recompute);
      publish({ supported: false, valueM: null });
    };
  }, [mapRef]);
}
