import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { MEASURE_SNAP_LAYER_IDS, snapFromFeature } from '@/lib/measure/snap';
import { useMeasureStore } from '@/stores/measureStore';
import {
  MEASURE_VERTEX_HITBOX_LAYER_ID,
  addMeasureLayer,
  removeMeasureLayer,
  updateMeasureLine,
} from '../layers';
import type { MapRef } from './useMapSetup';

/** Half-size of the pixel box used to re-attach a dragged start point. */
const SNAP_PADDING_PX = 6;

/** The anchor under a screen point, with its position, or null. */
function snapAt(map: maplibregl.Map, point: maplibregl.Point) {
  const box: [[number, number], [number, number]] = [
    [point.x - SNAP_PADDING_PX, point.y - SNAP_PADDING_PX],
    [point.x + SNAP_PADDING_PX, point.y + SNAP_PADDING_PX],
  ];
  for (const layerId of MEASURE_SNAP_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue;
    const feature = map.queryRenderedFeatures(box, { layers: [layerId] })[0];
    if (!feature || feature.geometry.type !== 'Point') continue;
    const snap = snapFromFeature(layerId, feature.properties ?? {});
    const [lon, lat] = feature.geometry.coordinates;
    if (snap && lon !== undefined && lat !== undefined) {
      return { snap, point: { latitude: lat, longitude: lon } };
    }
  }
  return null;
}

/**
 * Draws the measurement line, runs the placing interaction and lets the
 * user drag its vertices afterwards.
 *
 * Call this from the component that owns the map, after `useMapSetup`, so
 * the effects run once the map exists. The store holds the line; this hook
 * only mirrors it onto the map and feeds mouse input back into the store.
 */
export function useMeasureTool(mapRef: MapRef): void {
  const placing = useMeasureStore((s) => s.placing);

  // Layer lifecycle: add on load and after every style reload, mirror the store into it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const current = () => {
      const s = useMeasureStore.getState();
      return s.draft ?? s.line;
    };
    const init = () => {
      void addMeasureLayer(map, current());
    };
    if (map.isStyleLoaded()) init();
    else map.once('load', init);
    map.on('style.load', init);

    const unsubscribe = useMeasureStore.subscribe((s, prev) => {
      const next = s.draft ?? s.line;
      if (next !== (prev.draft ?? prev.line)) updateMeasureLine(map, next);
    });

    return () => {
      unsubscribe();
      map.off('style.load', init);
      removeMeasureLayer(map);
    };
  }, [mapRef]);

  // Placing: the end follows the mouse, a click adds a vertex, a double-click or
  // Enter finishes, Escape keeps what is placed (or cancels a bare start).
  //
  // Clicks are taken in the capture phase on the map container and stopped
  // there, so MapLibre never dispatches them: the airport, navaid and gate click
  // handlers would otherwise fire on the vertex click and fly the camera away
  // mid-placement.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !placing) return;
    const store = useMeasureStore.getState();
    const canvas = map.getCanvas();
    const container = map.getContainer();

    map.dragPan.disable();
    map.doubleClickZoom.disable();
    canvas.style.cursor = 'crosshair';

    const pointAt = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const lngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
      return { latitude: lngLat.lat, longitude: lngLat.lng };
    };
    const onMove = (e: maplibregl.MapMouseEvent) => {
      // Layer hover handlers reset the cursor; keep the crosshair while placing.
      canvas.style.cursor = 'crosshair';
      store.moveEnd({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    };
    const onClick = (e: MouseEvent) => {
      e.stopPropagation();
      store.moveEnd(pointAt(e));
      store.addPoint();
    };
    const onDblClick = (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      store.finish();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') store.finish();
      if (e.key === 'Escape') {
        // Two fixed points or more keep the line; a bare start is dropped.
        if (!store.finish()) store.cancel();
      }
    };

    map.on('mousemove', onMove);
    container.addEventListener('click', onClick, true);
    container.addEventListener('dblclick', onDblClick, true);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      map.off('mousemove', onMove);
      container.removeEventListener('click', onClick, true);
      container.removeEventListener('dblclick', onDblClick, true);
      window.removeEventListener('keydown', onKeyDown);
      // Interaction handlers are nulled by MapLibre's remove(); skip when the map is gone.
      if (map.dragPan) map.dragPan.enable();
      if (map.doubleClickZoom) map.doubleClickZoom.enable();
      canvas.style.cursor = '';
    };
  }, [mapRef, placing]);

  // Dragging a vertex of the placed line. The start re-attaches to whatever it is dropped on.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || placing) return;
    const store = useMeasureStore.getState();
    let dragIndex: number | null = null;

    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (dragIndex === null) return;
      store.setPoint(dragIndex, { latitude: e.lngLat.lat, longitude: e.lngLat.lng });
    };
    const onUp = (e: maplibregl.MapMouseEvent) => {
      if (dragIndex === null) return;
      const index = dragIndex;
      dragIndex = null;
      map.off('mousemove', onMove);
      if (map.dragPan) map.dragPan.enable();
      if (index === 0) {
        const hit = snapAt(map, e.point);
        if (hit) store.setPoint(0, hit.point);
        store.setSnap(hit?.snap ?? null);
      }
    };
    const onDown = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.originalEvent.button !== 0) return;
      const index = e.features?.[0]?.properties?.index;
      if (typeof index !== 'number') return;
      e.preventDefault();
      dragIndex = index;
      map.dragPan.disable();
      map.on('mousemove', onMove);
      map.once('mouseup', onUp);
    };

    map.on('mousedown', MEASURE_VERTEX_HITBOX_LAYER_ID, onDown);
    return () => {
      map.off('mousedown', MEASURE_VERTEX_HITBOX_LAYER_ID, onDown);
      map.off('mousemove', onMove);
      map.off('mouseup', onUp);
      if (dragIndex !== null && map.dragPan) map.dragPan.enable();
    };
  }, [mapRef, placing]);
}
