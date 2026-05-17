import { useEffect } from 'react';
import {
  addOaciAirspaceLayer,
  removeOaciAirspaceLayer,
  setOaciAirspaceVisibility,
} from '../layers/navigation/OaciAirspaceLayer';
import { useMapStore } from '@/stores/mapStore';
import type { MapRef } from './useMapSetup';

export function useOaciVectorSync(mapRef: MapRef): void {
  const enabled = useMapStore((s) => s.oaciVectorEnabled);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled) {
      removeOaciAirspaceLayer(map);
      return;
    }

    let cancelled = false;

    void window.siaAPI.getOaciAirspaces().then((features) => {
      if (cancelled || !features?.length) return;
      addOaciAirspaceLayer(map, features);
      setOaciAirspaceVisibility(map, true);
    });

    return () => {
      cancelled = true;
      removeOaciAirspaceLayer(map);
    };
  }, [mapRef, enabled]);
}
