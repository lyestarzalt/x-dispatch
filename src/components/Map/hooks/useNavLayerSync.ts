import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { NavigationData } from '@/queries/useNavDataQuery';
import type { NavLayerVisibility } from '@/types/layers';
import { airspaceLayer, ilsLayer, navaidLayer } from '../layers';
import type { MapRef } from './useMapSetup';

interface UseNavLayerSyncOptions {
  mapRef: MapRef;
  navData: NavigationData | undefined;
  navVisibility: NavLayerVisibility;
  styleVersion: number;
}

export function useNavLayerSync({
  mapRef,
  navData,
  navVisibility,
  styleVersion,
}: UseNavLayerSyncOptions): void {
  // Sync local nav layers (navaids, ILS, airspaces)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navData) return;

    const updateNavLayers = async () => {
      try {
        if (!map.isStyleLoaded()) {
          map.once('styledata', () => updateNavLayers());
          return;
        }

        // Consolidated navaids (VOR, NDB, DME, TACAN)
        const allNavaids = [...navData.vors, ...navData.ndbs, ...navData.dmes];
        if (allNavaids.length > 0) {
          await navaidLayer.add(map, allNavaids);
          navaidLayer.setVisibility(map, navVisibility.navaids);
        }

        // ILS (separate due to complex geometry)
        if (navData.ils.length > 0) {
          await ilsLayer.add(map, navData.ils);
          ilsLayer.setVisibility(map, navVisibility.ils);
        }

        // Airspaces
        if (navData.airspaces.length > 0) {
          await airspaceLayer.add(map, navData.airspaces);
          airspaceLayer.setVisibility(map, navVisibility.airspaces);
        }
      } catch (err) {
        window.appAPI.log.error('Nav layer update failed', err);
      }
    };

    updateNavLayers();
  }, [mapRef, navData, navVisibility, styleVersion]);
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
