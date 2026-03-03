import { useEffect } from 'react';
import { IvaoData, getPilotsInBounds } from '@/queries/useIvaoQuery';
import { removeIvaoPilotLayer, setupIvaoClickHandler, updateIvaoPilotLayer } from '../layers';
import type { MapRef, PopupRef } from './useMapSetup';

interface UseIvaoSyncOptions {
  mapRef: MapRef;
  ivaoPopupRef: PopupRef;
  ivaoData: IvaoData | undefined;
  ivaoEnabled: boolean;
  styleVersion: number;
}

export function useIvaoSync({
  mapRef,
  ivaoPopupRef,
  ivaoData,
  ivaoEnabled,
  styleVersion,
}: UseIvaoSyncOptions): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ivaoEnabled) return;

    const updateIvao = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', updateIvao);
        return;
      }

      const bounds = map.getBounds();
      const pilotsInView = getPilotsInBounds(ivaoData, {
        north: bounds.getNorthEast().lat,
        south: bounds.getSouthWest().lat,
        east: bounds.getNorthEast().lng,
        west: bounds.getSouthWest().lng,
      });

      updateIvaoPilotLayer(map, pilotsInView);
      if (ivaoPopupRef.current) {
        setupIvaoClickHandler(map, ivaoPopupRef.current);
      }
    };

    const handleMoveEnd = () => {
      if (ivaoEnabled && ivaoData) updateIvao();
    };

    map.on('moveend', handleMoveEnd);
    updateIvao();

    return () => {
      map.off('moveend', handleMoveEnd);
    };
  }, [mapRef, ivaoPopupRef, ivaoData, ivaoEnabled, styleVersion]);
}

export function toggleIvaoLayer(mapRef: MapRef, ivaoPopupRef: PopupRef, enable: boolean): void {
  const map = mapRef.current;
  if (!map) return;

  if (!enable) {
    removeIvaoPilotLayer(map);
  } else if (ivaoPopupRef.current) {
    setupIvaoClickHandler(map, ivaoPopupRef.current);
  }
}
