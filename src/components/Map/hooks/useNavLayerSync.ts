import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { NavigationData } from '@/queries/useNavDataQuery';
import type { NavLayerVisibility } from '@/types/layers';
import { airspaceLayer, ilsLayer, navaidLayer } from '../layers';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

interface UseNavLayerSyncOptions {
  mapRef: MapRef;
  navData: NavigationData | undefined;
  navVisibility: NavLayerVisibility;
}

export function useNavLayerSync({ mapRef, navData, navVisibility }: UseNavLayerSyncOptions): void {
  // Sync local nav layers (navaids, ILS, airspaces)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navData) return;

    let cancelled = false;

    const run = async () => {
      if (cancelled) return;
      try {
        // Use update() everywhere so an empty array clears the existing
        // layer instead of silently leaving stale data on screen when the
        // new airport has nothing in range. update() falls back to add()
        // the first time through.
        const allNavaids = [...navData.vors, ...navData.ndbs, ...navData.dmes];
        await navaidLayer.update(map, allNavaids);
        navaidLayer.setVisibility(map, navVisibility.navaids);

        // ILS — `navData.ils` carries LOC records, `navData.gs` carries
        // the matching glide-slope navaids (separate arrays per
        // `useNavDataQuery`). The ILS layer needs both to pair LOC ↔ GS
        // and render the wedge.
        await ilsLayer.update(map, [...navData.ils, ...navData.gs]);
        ilsLayer.setVisibility(map, navVisibility.ils);

        await airspaceLayer.update(map, navData.airspaces);
        airspaceLayer.setVisibility(map, navVisibility.airspaces);
      } catch (err) {
        window.appAPI.log.error('Nav layer update failed', err);
      }
    };

    const cleanupStyleWait = runWhenStyleIsReady(map, () => {
      void run();
    });

    return () => {
      cancelled = true;
      cleanupStyleWait();
    };
  }, [mapRef, navData, navVisibility]);
}

// Helper to apply visibility changes for individual nav layers
export function applyNavVisibilityChange(
  map: maplibregl.Map,
  layer: keyof NavLayerVisibility,
  visibility: NavLayerVisibility
): void {
  switch (layer) {
    case 'navaids':
      navaidLayer.setVisibility(map, visibility.navaids);
      break;
    case 'ils':
      ilsLayer.setVisibility(map, visibility.ils);
      break;
    case 'airspaces':
      airspaceLayer.setVisibility(map, visibility.airspaces);
      break;
  }
}
