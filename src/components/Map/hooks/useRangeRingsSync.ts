import { useEffect, useMemo } from 'react';
import { useMapStore } from '@/stores/mapStore';
import type { Coordinates } from '@/types/geo';
import { RANGE_RING_COLORS, RANGE_RING_LABELS, RANGE_RING_SPEEDS } from '@/types/layers';
import { addRangeRingsLayer, removeRangeRingsLayer } from '../layers';
import type { RangeRingsConfig } from '../layers';
import type { MapRef } from './useMapSetup';

interface UseRangeRingsSyncOptions {
  mapRef: MapRef;
  navDataLocation: Coordinates | null;
}

export function useRangeRingsSync({ mapRef, navDataLocation }: UseRangeRingsSyncOptions): void {
  const rangeRingsEnabled = useMapStore((s) => s.rangeRingsEnabled);
  const rangeRingsDuration = useMapStore((s) => s.rangeRingsDuration);
  const rangeRingsCategories = useMapStore((s) => s.rangeRingsCategories);
  const setRangeRingsDuration = useMapStore((s) => s.setRangeRingsDuration);

  // Use primitive values so airport switches always trigger recalculation
  const centerLat = navDataLocation?.latitude ?? null;
  const centerLon = navDataLocation?.longitude ?? null;

  const config = useMemo<RangeRingsConfig | null>(() => {
    if (
      !rangeRingsEnabled ||
      centerLat === null ||
      centerLon === null ||
      rangeRingsCategories.length === 0
    )
      return null;

    return {
      centerLat,
      centerLon,
      durationHours: rangeRingsDuration,
      categories: rangeRingsCategories.map((id) => ({
        id,
        color: RANGE_RING_COLORS[id],
        speed: RANGE_RING_SPEEDS[id],
        label: RANGE_RING_LABELS[id],
      })),
    };
  }, [rangeRingsEnabled, rangeRingsDuration, rangeRingsCategories, centerLat, centerLon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!config) {
      removeRangeRingsLayer(map);
      return;
    }

    const addLayer = () => {
      if (!mapRef.current) return;
      try {
        addRangeRingsLayer(map, config, setRangeRingsDuration);
      } catch (err) {
        window.appAPI?.log?.error?.('Failed to add range rings layer', err);
      }
    };

    if (!map.isStyleLoaded()) {
      map.once('styledata', addLayer);
      return () => {
        map.off('styledata', addLayer);
        removeRangeRingsLayer(map);
      };
    }

    addLayer();

    return () => {
      removeRangeRingsLayer(map);
    };
  }, [mapRef, config, setRangeRingsDuration]);
}
