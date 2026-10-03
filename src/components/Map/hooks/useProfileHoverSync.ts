/**
 * Mirrors the point hovered on the vertical profile as a ball on the map, live.
 */
import { useEffect } from 'react';
import { useMapStore } from '@/stores/mapStore';
import {
  removeProfileHoverLayer,
  setProfileHoverMarker,
} from '../layers/dynamic/ProfileHoverLayer';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

export function useProfileHoverSync(mapRef: MapRef): void {
  const hover = useMapStore((s) => s.profileHover);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const cleanup = runWhenStyleIsReady(map, () => {
      setProfileHoverMarker(map, hover);
    });
    return cleanup;
  }, [mapRef, hover]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map) removeProfileHoverLayer(map);
    };
  }, [mapRef]);
}
