import { useEffect, useMemo, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { natCrossing, trackInRoute } from '@/lib/flightplan/builder/trackChoice';
import { useOceanicTracks } from '@/queries/useOceanicTracks';
import { useMapStore } from '@/stores/mapStore';
import { usePlanBuilderStore } from '@/stores/planBuilderStore';
import {
  NAT_TRACKS_HIT_LAYER_ID,
  type TrackDrawItem,
  addNatTracksLayer,
  natTrackPopupHtml,
  removeNatTracksLayer,
  trackFromFeature,
} from '../layers/dynamic/NatTracksLayer';
import { runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

interface UseNatTracksSyncOptions {
  mapRef: MapRef;
}

/**
 * Shows the North Atlantic tracks: for the planner's crossing while it is open (the flown
 * direction: current and upcoming sets, or the last published one while nothing is on), or
 * every set when the map layer is switched on.
 * The track filed in the route is highlighted. Hovering a track shows its details; a click
 * while the planner is open asks the planner to route through it, and the dialog does the
 * routing so the procedure joins it knows are kept.
 */
export function useNatTracksSync({ mapRef }: UseNatTracksSyncOptions): void {
  const isOpen = usePlanBuilderStore((s) => s.isOpen);
  const departure = usePlanBuilderStore((s) => s.departure);
  const arrival = usePlanBuilderStore((s) => s.arrival);
  const routeText = usePlanBuilderStore((s) => s.routeText);
  const requestTrack = usePlanBuilderStore((s) => s.requestTrack);
  const layerOn = useMapStore((s) => s.navVisibility.natTracks);

  const crossing = isOpen && departure && arrival ? natCrossing(departure, arrival) : null;
  const wanted = layerOn || crossing !== null;
  const { data: feed } = useOceanicTracks(wanted);
  const shown = useMemo<TrackDrawItem[]>(() => {
    if (!wanted || !feed) return [];
    const items: TrackDrawItem[] = [];
    for (const message of feed.messages) {
      if (crossing && message.eastbound !== (crossing === 'eastbound')) continue;
      for (const track of message.tracks) {
        items.push({ track, status: message.status });
      }
    }
    return items;
  }, [feed, crossing, wanted]);
  const selected = useMemo(() => (isOpen ? trackInRoute(routeText) : null), [isOpen, routeText]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (shown.length === 0) {
      removeNatTracksLayer(map);
      return;
    }
    // Adding is an in-place update once the layers exist, so a new selection does not flash.
    return runWhenStyleIsReady(map, () => {
      if (mapRef.current) addNatTracksLayer(map, shown, selected);
    });
  }, [mapRef, shown, selected]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    return () => {
      if (map.getStyle()) removeNatTracksLayer(map);
    };
  }, [mapRef]);

  // One popup for the hook's lifetime; it follows the cursor along the track.
  const popupRef = useRef<maplibregl.Popup | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      className: 'airport-popup',
      offset: 12,
    });
    popupRef.current = popup;
    const onMove = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      const hit = feature ? trackFromFeature(feature.properties ?? {}) : null;
      if (!hit) return;
      popup.setLngLat(e.lngLat).setHTML(natTrackPopupHtml(hit.track, hit.status)).addTo(map);
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    };
    map.on('mousemove', NAT_TRACKS_HIT_LAYER_ID, onMove);
    map.on('mouseenter', NAT_TRACKS_HIT_LAYER_ID, onEnter);
    map.on('mouseleave', NAT_TRACKS_HIT_LAYER_ID, onLeave);
    return () => {
      map.off('mousemove', NAT_TRACKS_HIT_LAYER_ID, onMove);
      map.off('mouseenter', NAT_TRACKS_HIT_LAYER_ID, onEnter);
      map.off('mouseleave', NAT_TRACKS_HIT_LAYER_ID, onLeave);
      popup.remove();
      popupRef.current = null;
    };
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isOpen) return;
    const onClick = (e: maplibregl.MapLayerMouseEvent) => {
      const name = e.features?.[0]?.properties?.name;
      if (typeof name === 'string') requestTrack(name);
    };
    map.on('click', NAT_TRACKS_HIT_LAYER_ID, onClick);
    return () => {
      map.off('click', NAT_TRACKS_HIT_LAYER_ID, onClick);
    };
  }, [mapRef, isOpen, requestTrack]);
}
