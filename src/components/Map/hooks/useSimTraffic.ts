import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import type { TrafficSnapshot } from '@/types/traffic';
import { removeSimTrafficLayer, updateSimTrafficLayer } from '../layers/dynamic/SimTrafficLayer';

type MapRef = React.MutableRefObject<maplibregl.Map | null>;

/**
 * X-Plane AI and plugin traffic from the TCAS target table. The main process
 * only subscribes to the arrays while this layer is on, so an idle toggle costs
 * nothing on the sim side.
 */
export function useSimTraffic(mapRef: MapRef): void {
  const enabled = useMapStore((s) => s.simTrafficEnabled);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !enabled) return;

    let cancelled = false;
    let latest: TrafficSnapshot | null = null;
    let applying = false;

    const apply = async () => {
      if (applying || !latest || cancelled) return;
      applying = true;
      const snapshot = latest;
      latest = null;
      try {
        await updateSimTrafficLayer(map, snapshot.targets);
      } finally {
        applying = false;
      }
      if (latest) void apply();
    };

    const unsubscribe = window.xplaneServiceAPI.onTrafficUpdate((snapshot) => {
      latest = snapshot;
      void apply();
    });
    void window.xplaneServiceAPI.setTrafficEnabled(true);

    const onStyleLoad = () => {
      if (latest === null) latest = { targets: [], at: Date.now() };
      void apply();
    };
    map.on('style.load', onStyleLoad);

    return () => {
      cancelled = true;
      unsubscribe();
      map.off('style.load', onStyleLoad);
      void window.xplaneServiceAPI.setTrafficEnabled(false);
      removeSimTrafficLayer(map);
    };
  }, [mapRef, enabled]);
}
