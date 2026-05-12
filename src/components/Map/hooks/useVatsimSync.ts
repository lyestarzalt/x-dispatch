import { useEffect } from 'react';
import { VatsimData, getPilotsInBounds } from '@/queries/useVatsimQuery';
import { removeVatsimPilotLayer, setupVatsimClickHandler, updateVatsimPilotLayer } from '../layers';
import type { MapRef, PopupRef } from './useMapSetup';

interface UseVatsimSyncOptions {
  mapRef: MapRef;
  vatsimPopupRef: PopupRef;
  vatsimData: VatsimData | undefined;
  vatsimEnabled: boolean;
}

export function useVatsimSync({
  mapRef,
  vatsimPopupRef,
  vatsimData,
  vatsimEnabled,
}: UseVatsimSyncOptions): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // When VATSIM is toggled off, tear down the layer here instead of relying
    // on the toggle handler — `updateVatsim` can queue itself for a future
    // `styledata` event when the style is reloading, and that queued callback
    // would otherwise re-add the layer after the user disabled it.
    if (!vatsimEnabled) {
      removeVatsimPilotLayer(map);
      return;
    }

    const updateVatsim = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', updateVatsim);
        return;
      }

      const bounds = map.getBounds();
      const pilotsInView = getPilotsInBounds(vatsimData, {
        north: bounds.getNorthEast().lat,
        south: bounds.getSouthWest().lat,
        east: bounds.getNorthEast().lng,
        west: bounds.getSouthWest().lng,
      });

      updateVatsimPilotLayer(map, pilotsInView);
      if (vatsimPopupRef.current) {
        setupVatsimClickHandler(map, vatsimPopupRef.current);
      }
    };

    const handleMoveEnd = () => {
      if (vatsimEnabled && vatsimData) updateVatsim();
    };

    map.on('moveend', handleMoveEnd);
    updateVatsim();

    return () => {
      map.off('moveend', handleMoveEnd);
      // Cancel any pending `once('styledata', updateVatsim)` queued by the
      // deferred-load path so a late style.load can't bring the layer back.
      map.off('styledata', updateVatsim);
    };
  }, [mapRef, vatsimPopupRef, vatsimData, vatsimEnabled]);
}

export function toggleVatsimLayer(mapRef: MapRef, vatsimPopupRef: PopupRef, enable: boolean): void {
  const map = mapRef.current;
  if (!map) return;

  if (!enable) {
    removeVatsimPilotLayer(map);
  } else if (vatsimPopupRef.current) {
    setupVatsimClickHandler(map, vatsimPopupRef.current);
  }
}
