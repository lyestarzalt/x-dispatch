import { useEffect } from 'react';
import { setTerrainShadingVisibility } from '../utils/globeUtils';
import type { MapRef } from './useMapSetup';

export function useTerrainShading(mapRef: MapRef, enabled: boolean): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Layers are created by setup3DTerrain (runs on map 'load').
    // On subsequent toggles the layers already exist, apply immediately.
    setTerrainShadingVisibility(map, enabled);
  }, [mapRef, enabled]);
}
