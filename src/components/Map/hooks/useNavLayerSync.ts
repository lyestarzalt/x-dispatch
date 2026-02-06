import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { GlobalAirwaysData, NavigationData } from '@/queries/useNavDataQuery';
import type { NavLayerVisibility } from '@/types/layers';
import {
  airspaceLayer,
  dmeLayer,
  highAirwayLayer,
  ilsLayer,
  lowAirwayLayer,
  ndbLayer,
  vorLayer,
  waypointLayer,
} from '../layers';
import type { MapRef } from './useMapSetup';

interface UseNavLayerSyncOptions {
  mapRef: MapRef;
  navData: NavigationData | undefined;
  airwaysData: GlobalAirwaysData | undefined;
  airwaysFetched: boolean;
  navVisibility: NavLayerVisibility;
}

export function useNavLayerSync({
  mapRef,
  navData,
  airwaysData,
  airwaysFetched,
  navVisibility,
}: UseNavLayerSyncOptions): void {
  // Sync local nav layers (VOR, NDB, DME, ILS, waypoints, airspaces)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navData) return;

    const updateNavLayers = async () => {
      try {
        if (!map.isStyleLoaded()) {
          map.once('styledata', () => updateNavLayers());
          return;
        }

        if (navData.vors.length > 0) {
          await vorLayer.add(map, navData.vors);
          vorLayer.setVisibility(map, navVisibility.vors);
        }
        if (navData.ndbs.length > 0) {
          await ndbLayer.add(map, navData.ndbs);
          ndbLayer.setVisibility(map, navVisibility.ndbs);
        }
        if (navData.dmes.length > 0) {
          await dmeLayer.add(map, navData.dmes);
          dmeLayer.setVisibility(map, navVisibility.dmes);
        }
        if (navData.ils.length > 0) {
          await ilsLayer.add(map, navData.ils);
          ilsLayer.setVisibility(map, navVisibility.ils);
        }
        if (navData.waypoints.length > 0) {
          await waypointLayer.add(map, navData.waypoints.slice(0, 2000));
          waypointLayer.setVisibility(map, navVisibility.waypoints);
        }
        if (navData.airspaces.length > 0) {
          await airspaceLayer.add(map, navData.airspaces);
          airspaceLayer.setVisibility(map, navVisibility.airspaces);
        }
      } catch (err) {
        window.appAPI.log.error('Nav layer update failed', err);
      }
    };

    updateNavLayers();
  }, [mapRef, navData, navVisibility]);

  // Sync global airways layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !airwaysFetched || !airwaysData) return;

    const updateAirwayLayers = () => {
      if (!map.isStyleLoaded()) {
        map.once('styledata', updateAirwayLayers);
        return;
      }

      try {
        if (navVisibility.airwaysMode === 'high' && airwaysData.highAirways.length > 0) {
          highAirwayLayer.remove(map);
          void highAirwayLayer.add(map, airwaysData.highAirways);
          lowAirwayLayer.remove(map);
        } else if (navVisibility.airwaysMode === 'low' && airwaysData.lowAirways.length > 0) {
          lowAirwayLayer.remove(map);
          void lowAirwayLayer.add(map, airwaysData.lowAirways);
          highAirwayLayer.remove(map);
        } else {
          highAirwayLayer.remove(map);
          lowAirwayLayer.remove(map);
        }
      } catch (err) {
        window.appAPI.log.error('Airway layer update failed', err);
      }
    };

    updateAirwayLayers();
  }, [mapRef, airwaysData, airwaysFetched, navVisibility.airwaysMode]);
}

// Helper to apply visibility changes for individual nav layers
export function applyNavVisibilityChange(
  map: maplibregl.Map,
  layer: keyof NavLayerVisibility,
  visibility: NavLayerVisibility
): void {
  switch (layer) {
    case 'vors':
      vorLayer.setVisibility(map, visibility.vors);
      break;
    case 'ndbs':
      ndbLayer.setVisibility(map, visibility.ndbs);
      break;
    case 'dmes':
      dmeLayer.setVisibility(map, visibility.dmes);
      break;
    case 'ils':
      ilsLayer.setVisibility(map, visibility.ils);
      break;
    case 'waypoints':
      waypointLayer.setVisibility(map, visibility.waypoints);
      break;
    case 'airspaces':
      airspaceLayer.setVisibility(map, visibility.airspaces);
      break;
  }
}
