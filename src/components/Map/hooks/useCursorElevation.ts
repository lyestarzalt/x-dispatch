import { useEffect, useRef, useState } from 'react';
import type maplibregl from 'maplibre-gl';
import type { MapRef } from './useMapSetup';

export interface CursorElevation {
  /**
   * True when the map has terrain set (mercator + user toggle on). Callers
   * use this to decide whether to render an elevation row at all — separate
   * from `valueM`, which is null whenever the cursor isn't over the map.
   */
  supported: boolean;
  /** Last queried elevation in metres, or null if the cursor is off-canvas. */
  valueM: number | null;
}

/**
 * Tracks the terrain elevation under the user's cursor and whether terrain
 * is even available. Splitting the two lets the UI keep its layout stable:
 * the elevation row stays mounted while terrain is on (showing a placeholder
 * when the cursor leaves the map) and only collapses when the projection or
 * the user setting drops terrain entirely.
 *
 * The screen-space cursor pixel is remembered across map moves so the value
 * stays current as the user pans/zooms with the cursor stationary.
 */
export function useCursorElevation(mapRef: MapRef): CursorElevation {
  const [supported, setSupported] = useState(false);
  const [valueM, setValueM] = useState<number | null>(null);
  const cursorPixelRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const refreshSupported = () => setSupported(map.getTerrain() != null);

    const recompute = () => {
      const pixel = cursorPixelRef.current;
      if (!pixel || !map.getTerrain()) {
        setValueM(null);
        return;
      }
      const lngLat = map.unproject([pixel.x, pixel.y]);
      const elev = map.queryTerrainElevation([lngLat.lng, lngLat.lat]);
      setValueM(typeof elev === 'number' && Number.isFinite(elev) ? elev : null);
    };

    const handleMouseMove = (e: maplibregl.MapMouseEvent) => {
      cursorPixelRef.current = { x: e.point.x, y: e.point.y };
      recompute();
    };
    const handleMouseOut = () => {
      cursorPixelRef.current = null;
      setValueM(null);
    };
    const handleTerrain = () => {
      refreshSupported();
      recompute();
    };

    refreshSupported();
    map.on('mousemove', handleMouseMove);
    map.on('mouseout', handleMouseOut);
    map.on('move', recompute);
    map.on('terrain', handleTerrain);

    return () => {
      map.off('mousemove', handleMouseMove);
      map.off('mouseout', handleMouseOut);
      map.off('move', recompute);
      map.off('terrain', handleTerrain);
    };
  }, [mapRef]);

  return { supported, valueM };
}
