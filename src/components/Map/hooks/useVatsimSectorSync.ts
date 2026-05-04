import { useEffect } from 'react';
import type { VatsimData } from '@/queries/useVatsimQuery';
import type { VatsimSectorQueryResult } from '@/types/vatsimSectors';
import {
  bringVatsimSectorLayersToTop,
  removeVatsimSectorLayer,
  updateVatsimSectorLayer,
} from '../layers';
import type { MapRef } from './useMapSetup';

interface UseVatsimSectorSyncOptions {
  mapRef: MapRef;
  sectorResult: VatsimSectorQueryResult | undefined;
  vatsimData: VatsimData | undefined;
  vatsimEnabled: boolean;
}

export function useVatsimSectorSync({
  mapRef,
  sectorResult,
  vatsimData,
  vatsimEnabled,
}: UseVatsimSectorSyncOptions): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const dataset = sectorResult?.dataset;

    if (!vatsimEnabled || !dataset) {
      removeVatsimSectorLayer(map);
      return;
    }

    const render = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', render);
        return;
      }

      updateVatsimSectorLayer(map, dataset, vatsimData?.controllers ?? []);
      bringVatsimSectorLayersToTop(map);
    };

    render();
  }, [mapRef, sectorResult, vatsimData, vatsimEnabled]);
}
