import { useEffect } from 'react';
import type { Airport } from '@/lib/xplaneServices/dataService';
import { useMapStore } from '@/stores/mapStore';
import { useSettingsStore } from '@/stores/settingsStore';
import type { NetworkPilot } from '@/types/networkTraffic';
import { networkTrafficColor, removeNetworkRouteLayer, updateNetworkRouteLayer } from '../layers';
import type { MapRef } from './useMapSetup';

interface UseNetworkRouteSyncOptions {
  mapRef: MapRef;
  airports: Airport[];
  pilots: NetworkPilot[];
}

/** Draws the selected network pilot's city pair on the map and takes it off on deselect. */
export function useNetworkRouteSync({ mapRef, airports, pilots }: UseNetworkRouteSyncOptions) {
  const selection = useMapStore((s) => s.networkSelection);
  const colorChoice = useSettingsStore((s) => s.graphics.networkTrafficColor);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pilot =
      selection?.kind === 'pilot'
        ? pilots.find((p) => p.network === selection.network && p.id === selection.id)
        : undefined;
    if (!pilot) {
      removeNetworkRouteLayer(map);
      return;
    }
    const airportAt = (icao: string | null) => {
      const a = icao ? airports.find((x) => x.icao === icao) : undefined;
      return a ? { latitude: a.lat, longitude: a.lon } : null;
    };
    const draw = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', draw);
        return;
      }
      updateNetworkRouteLayer(
        map,
        pilot,
        airportAt(pilot.flightPlan?.departure ?? null),
        airportAt(pilot.flightPlan?.arrival ?? null),
        networkTrafficColor(pilot.network, colorChoice)
      );
    };
    draw();
    return () => {
      map.off('styledata', draw);
    };
  }, [mapRef, selection, pilots, airports, colorChoice]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map) removeNetworkRouteLayer(map);
    };
  }, [mapRef]);
}
