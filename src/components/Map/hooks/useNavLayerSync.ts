import { useEffect } from 'react';
import * as maplibregl from 'maplibre-gl';
import { procedureNavaids } from '@/lib/flightplan/builder/procedureNavaids';
import type { BasemapTheme } from '@/lib/map/basemapTheme';
import type { NavigationData } from '@/queries/useNavDataQuery';
import { useAppStore } from '@/stores/appStore';
import type { NavLayerVisibility } from '@/types/layers';
import {
  airspaceLayer,
  ensureNavLayerOrder,
  ilsLayer,
  navaidLayer,
  procedureNavaidLayer,
} from '../layers';
import { PROCEDURE_ROUTE_LAYER_IDS } from '../layers/dynamic/ProcedureRouteLayer';
import { applyNavLayerTheme } from '../layers/navigation/navTheme';
import { isMapRemoved } from '../layers/types';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

/** The procedure's route and missed-approach lines come first in its layer list. */
const PROCEDURE_LINE_LAYERS = 2;

interface UseNavLayerSyncOptions {
  mapRef: MapRef;
  navData: NavigationData | undefined;
  navVisibility: NavLayerVisibility;
  theme: BasemapTheme;
}

export function useNavLayerSync({
  mapRef,
  navData,
  navVisibility,
  theme,
}: UseNavLayerSyncOptions): void {
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

        // Whichever layer got its first data last was added on top; put them back.
        ensureNavLayerOrder(map);
        applyNavLayerTheme(map, theme);
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
  }, [mapRef, navData, navVisibility, theme]);

  // With the navaid layer off, the stations of the procedure on the map are still drawn: the
  // VOR or NDB an approach is flown from (GitHub #430). With the layer on they are already
  // there, so this one is emptied. Only navaids loaded around the airport can be found.
  const selectedProcedure = useAppStore((s) => s.selectedProcedure);
  const navaidsShown = navVisibility.navaids;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !navData) return;
    const wanted =
      selectedProcedure && !navaidsShown
        ? procedureNavaids(selectedProcedure.waypoints, [
            ...navData.vors,
            ...navData.ndbs,
            ...navData.dmes,
          ])
        : [];

    let cancelled = false;
    const run = async () => {
      if (cancelled) return;
      try {
        await procedureNavaidLayer.update(map, wanted);
        if (cancelled || isMapRemoved(map)) return;
        // Over the procedure's lines, which are wide enough to cover a beacon whole, and under
        // its fixes and labels; whichever of the two was added first.
        const aboveLines = PROCEDURE_ROUTE_LAYER_IDS.slice(PROCEDURE_LINE_LAYERS).find((id) =>
          map.getLayer(id)
        );
        if (aboveLines) {
          for (const id of procedureNavaidLayer.getAllLayerIds()) {
            if (map.getLayer(id)) map.moveLayer(id, aboveLines);
          }
        }
        applyNavLayerTheme(map, theme);
      } catch (err) {
        window.appAPI.log.error('Procedure navaid layer update failed', err);
      }
    };
    const cleanupStyleWait = runWhenStyleIsReady(map, () => {
      void run();
    });
    return () => {
      cancelled = true;
      cleanupStyleWait();
    };
  }, [mapRef, navData, navaidsShown, selectedProcedure, theme]);
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
