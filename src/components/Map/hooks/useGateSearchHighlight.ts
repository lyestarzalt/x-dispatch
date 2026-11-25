import { useEffect, useMemo } from 'react';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import { GATE_SOURCE_ID, setGateSearchMatches } from '../layers/airport/GateLayer';
import type { MapRef } from './useMapSetup';

/**
 * Mirrors the airport card's gate search on the map: the gates it matches stay bright, the
 * rest fade. The gate layer is drawn again whenever the airport is, so the fade is put back
 * each time its source reloads while a search is on.
 */
export function useGateSearchHighlight(mapRef: MapRef): void {
  const matches = useMapStore((s) => s.gateSearchMatches);
  const gateCount = useAppStore((s) => s.selectedAirportData?.startupLocations?.length ?? 0);
  const matchSet = useMemo(() => (matches ? new Set(matches) : null), [matches]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => setGateSearchMatches(map, gateCount, matchSet);
    apply();
    if (!matchSet) return;
    const onSource = (e: { sourceId?: string; isSourceLoaded?: boolean }) => {
      if (e.sourceId === GATE_SOURCE_ID && e.isSourceLoaded) apply();
    };
    map.on('sourcedata', onSource);
    return () => {
      map.off('sourcedata', onSource);
    };
  }, [mapRef, gateCount, matchSet]);
}
