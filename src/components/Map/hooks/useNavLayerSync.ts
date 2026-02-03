import { useEffect } from 'react';
import maplibregl from 'maplibre-gl';
import type { GlobalAirwaysData, NavigationData } from '@/queries/useNavDataQuery';
import type { NavLayerVisibility } from '@/types/layers';
import {
  addAirspaceLayer,
  addDMELayer,
  addHighAirwayLayer,
  addILSLayer,
  addLowAirwayLayer,
  addNDBLayer,
  addVORLayer,
  addWaypointLayer,
  removeHighAirwayLayer,
  removeLowAirwayLayer,
  setAirspaceLayerVisibility,
  setDMELayerVisibility,
  setILSLayerVisibility,
  setNDBLayerVisibility,
  setVORLayerVisibility,
  setWaypointLayerVisibility,
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
          await addVORLayer(map, navData.vors);
          setVORLayerVisibility(map, navVisibility.vors);
        }
        if (navData.ndbs.length > 0) {
          await addNDBLayer(map, navData.ndbs);
          setNDBLayerVisibility(map, navVisibility.ndbs);
        }
        if (navData.dmes.length > 0) {
          addDMELayer(map, navData.dmes);
          setDMELayerVisibility(map, navVisibility.dmes);
        }
        if (navData.ils.length > 0) {
          await addILSLayer(map, navData.ils);
          setILSLayerVisibility(map, navVisibility.ils);
        }
        if (navData.waypoints.length > 0) {
          addWaypointLayer(map, navData.waypoints.slice(0, 2000));
          setWaypointLayerVisibility(map, navVisibility.waypoints);
        }
        if (navData.airspaces.length > 0) {
          addAirspaceLayer(map, navData.airspaces);
          setAirspaceLayerVisibility(map, navVisibility.airspaces);
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
          removeHighAirwayLayer(map);
          addHighAirwayLayer(map, airwaysData.highAirways);
          removeLowAirwayLayer(map);
        } else if (navVisibility.airwaysMode === 'low' && airwaysData.lowAirways.length > 0) {
          removeLowAirwayLayer(map);
          addLowAirwayLayer(map, airwaysData.lowAirways);
          removeHighAirwayLayer(map);
        } else {
          removeHighAirwayLayer(map);
          removeLowAirwayLayer(map);
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
      setVORLayerVisibility(map, visibility.vors);
      break;
    case 'ndbs':
      setNDBLayerVisibility(map, visibility.ndbs);
      break;
    case 'dmes':
      setDMELayerVisibility(map, visibility.dmes);
      break;
    case 'ils':
      setILSLayerVisibility(map, visibility.ils);
      break;
    case 'waypoints':
      setWaypointLayerVisibility(map, visibility.waypoints);
      break;
    case 'airspaces':
      setAirspaceLayerVisibility(map, visibility.airspaces);
      break;
  }
}
