import { useEffect } from 'react';
import { pilotsInBounds } from '@/lib/networkTraffic/normalize';
import { useSettingsStore } from '@/stores/settingsStore';
import type { NetworkId, NetworkPilot } from '@/types/networkTraffic';
import {
  applyNetworkRouteColors,
  removeNetworkTrafficLayer,
  setOnlineTrafficColor,
  setupNetworkTrafficClickHandler,
  updateNetworkTrafficLayer,
} from '../layers';
import type { MapRef } from './useMapSetup';

const NETWORKS: NetworkId[] = ['vatsim', 'ivao'];

interface UseNetworkTrafficSyncOptions {
  mapRef: MapRef;
  /** The network switched on, or null when neither is. */
  network: NetworkId | null;
  pilots: NetworkPilot[];
}

/**
 * Keeps the active network's pilots on the map, only those in view, refreshed on every poll
 * and every pan. Switching the network off, or to the other one, clears the layer here so a
 * refresh queued behind a style reload cannot bring it back.
 */
export function useNetworkTrafficSync({ mapRef, network, pilots }: UseNetworkTrafficSyncOptions) {
  // The pilot's colour for online traffic (Settings, Graphics). Declared before the effect that
  // draws the traffic, so the first aircraft already come out in it.
  const onlineTrafficColor = useSettingsStore((s) => s.map.onlineTrafficColor);
  useEffect(() => {
    const map = mapRef.current;
    setOnlineTrafficColor(map, onlineTrafficColor);
    if (map) applyNetworkRouteColors(map);
  }, [mapRef, onlineTrafficColor]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    for (const other of NETWORKS) {
      if (other !== network) removeNetworkTrafficLayer(map, other);
    }
    if (!network) return;

    const update = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', update);
        return;
      }
      const b = map.getBounds();
      const inView = pilotsInBounds(pilots, {
        north: b.getNorthEast().lat,
        south: b.getSouthWest().lat,
        east: b.getNorthEast().lng,
        west: b.getSouthWest().lng,
      });
      void updateNetworkTrafficLayer(map, network, inView);
      setupNetworkTrafficClickHandler(map, network);
    };

    map.on('moveend', update);
    update();
    return () => {
      map.off('moveend', update);
      map.off('styledata', update);
    };
  }, [mapRef, network, pilots]);

  // Nothing left on the map once the overlay goes.
  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map) for (const n of NETWORKS) removeNetworkTrafficLayer(map, n);
    };
  }, [mapRef]);
}
