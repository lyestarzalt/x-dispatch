import { useEffect } from 'react';
import { useGateSearchStore } from '@/stores/gateSearchStore';
import { setGateSearchMatches } from '../layers';
import type { MapRef } from './useMapSetup';

/** Shows the airport panel's gate search on the map: matches ringed, the other gates faded. */
export function useGateSearchHighlight(mapRef: MapRef): void {
  const matches = useGateSearchStore((s) => s.matches);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    setGateSearchMatches(map, matches);
  }, [mapRef, matches]);
}
