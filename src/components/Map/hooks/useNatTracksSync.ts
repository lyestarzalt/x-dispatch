import { useEffect, useMemo } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { natCrossing, trackInRoute } from '@/lib/flightplan/builder/trackChoice';
import { useOceanicTracks } from '@/queries/useOceanicTracks';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import {
  NAT_TRACKS_HIT_LAYER_ID,
  addNatTracksLayer,
  removeNatTracksLayer,
} from '../layers/dynamic/NatTracksLayer';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

interface UseNatTracksSyncOptions {
  mapRef: MapRef;
}

/**
 * Shows the North Atlantic tracks for the planner's crossing while the planner is open, with
 * the track filed in the route highlighted. A click on a track asks the planner to route
 * through it; the dialog does the routing so the procedure joins it knows are kept.
 */
export function useNatTracksSync({ mapRef }: UseNatTracksSyncOptions): void {
  const isOpen = usePlanBuilderStore((s) => s.isOpen);
  const departure = usePlanBuilderStore((s) => s.departure);
  const arrival = usePlanBuilderStore((s) => s.arrival);
  const routeText = usePlanBuilderStore((s) => s.routeText);
  const requestTrack = usePlanBuilderStore((s) => s.requestTrack);

  const crossing = departure && arrival ? natCrossing(departure, arrival) : null;
  const { data: tracks } = useOceanicTracks(isOpen && crossing !== null);
  const shown = useMemo(
    () =>
      crossing && tracks ? tracks.filter((t) => t.eastbound === (crossing === 'eastbound')) : [],
    [tracks, crossing]
  );
  const selected = useMemo(() => trackInRoute(routeText), [routeText]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!isOpen || shown.length === 0) {
      removeNatTracksLayer(map);
      return;
    }
    // Adding is an in-place update once the layers exist, so a new selection does not flash.
    return runWhenStyleIsReady(map, () => {
      if (mapRef.current) addNatTracksLayer(map, shown, selected);
    });
  }, [mapRef, isOpen, shown, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return () => {
      if (map.getStyle()) removeNatTracksLayer(map);
    };
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isOpen) return;
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const name = e.features?.[0]?.properties?.name;
      if (typeof name === 'string') requestTrack(name);
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };
    map.on('click', NAT_TRACKS_HIT_LAYER_ID, onClick);
    map.on('mouseenter', NAT_TRACKS_HIT_LAYER_ID, onEnter);
    map.on('mouseleave', NAT_TRACKS_HIT_LAYER_ID, onLeave);
    return () => {
      map.off('click', NAT_TRACKS_HIT_LAYER_ID, onClick);
      map.off('mouseenter', NAT_TRACKS_HIT_LAYER_ID, onEnter);
      map.off('mouseleave', NAT_TRACKS_HIT_LAYER_ID, onLeave);
    };
  }, [mapRef, isOpen, requestTrack]);
}
