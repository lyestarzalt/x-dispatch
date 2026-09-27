import { useEffect, useRef } from 'react';
import { useMapStore } from '@/stores/mapStore';
import type { Coordinates } from '@/types/geo';
import type { RangeRingCategory } from '@/types/layers';
import { RANGE_RING_COLORS, RANGE_RING_LABELS, RANGE_RING_SPEEDS } from '@/types/layers';
import { addRangeRingsLayer, removeRangeRingsLayer, updateRangeRingsData } from '../layers';
import type { RangeRingsConfig } from '../layers';
import type { MapRef } from './useMapSetup';

interface UseRangeRingsSyncOptions {
  mapRef: MapRef;
  navDataLocation: Coordinates | null;
}

function buildConfig(
  centerLat: number,
  centerLon: number,
  durationHours: number,
  categoryIds: RangeRingCategory[]
): RangeRingsConfig {
  return {
    centerLat,
    centerLon,
    durationHours,
    categories: categoryIds.map((id) => ({
      id,
      color: RANGE_RING_COLORS[id],
      speed: RANGE_RING_SPEEDS[id],
      label: RANGE_RING_LABELS[id],
    })),
  };
}

export function useRangeRingsSync({ mapRef, navDataLocation }: UseRangeRingsSyncOptions): void {
  const rangeRingsEnabled = useMapStore((s) => s.rangeRingsEnabled);
  const rangeRingsDuration = useMapStore((s) => s.rangeRingsDuration);
  const rangeRingsCategories = useMapStore((s) => s.rangeRingsCategories);
  const setRangeRingsDuration = useMapStore((s) => s.setRangeRingsDuration);

  // Use primitive values so airport switches always trigger recalculation
  const centerLat = navDataLocation?.latitude ?? null;
  const centerLon = navDataLocation?.longitude ?? null;
  const categoriesKey = rangeRingsCategories.join(',');

  const durationRef = useRef(rangeRingsDuration);
  const appliedDurationRef = useRef<number | null>(null);
  useEffect(() => {
    durationRef.current = rangeRingsDuration;
  }, [rangeRingsDuration]);

  // Structural changes (enable, airport, categories) rebuild the layers and
  // replay the entrance sweep.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const active =
      rangeRingsEnabled && centerLat !== null && centerLon !== null && categoriesKey !== '';
    if (!active) {
      removeRangeRingsLayer(map);
      return;
    }

    const addLayer = () => {
      if (!mapRef.current) return;
      try {
        appliedDurationRef.current = durationRef.current;
        addRangeRingsLayer(
          map,
          buildConfig(
            centerLat,
            centerLon,
            durationRef.current,
            categoriesKey.split(',') as RangeRingCategory[]
          ),
          setRangeRingsDuration
        );
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
  }, [mapRef, rangeRingsEnabled, centerLat, centerLon, categoriesKey, setRangeRingsDuration]);

  // Duration-only changes (drag resize) refresh the data in place: no layer
  // teardown, no flicker, drag listeners stay attached.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (appliedDurationRef.current === rangeRingsDuration) return;
    if (!rangeRingsEnabled || centerLat === null || centerLon === null || categoriesKey === '')
      return;
    appliedDurationRef.current = rangeRingsDuration;
    updateRangeRingsData(
      map,
      buildConfig(
        centerLat,
        centerLon,
        rangeRingsDuration,
        categoriesKey.split(',') as RangeRingCategory[]
      )
    );
  }, [mapRef, rangeRingsDuration, rangeRingsEnabled, centerLat, centerLon, categoriesKey]);
}
