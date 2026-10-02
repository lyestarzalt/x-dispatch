import { useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { MEASURE_SNAP_LAYER_IDS, snapFromFeature } from '@/lib/measure/snap';
import { useMapStore } from '@/stores/mapStore';
import { useMeasureStore } from '@/stores/measureStore';
import { MEASURE_HITBOX_LAYER_ID, MEASURE_VERTEX_HITBOX_LAYER_ID } from '../layers';
import type { MapRef } from './useMapSetup';

/** Half-size of the pixel box around the click used to pick up nearby features. */
const HIT_PADDING_PX = 6;

function hitBox(point: maplibregl.Point): [[number, number], [number, number]] {
  return [
    [point.x - HIT_PADDING_PX, point.y - HIT_PADDING_PX],
    [point.x + HIT_PADDING_PX, point.y + HIT_PADDING_PX],
  ];
}

/** Rendered features in the box, restricted to layers the style has right now. */
function featuresAt(map: maplibregl.Map, point: maplibregl.Point, layerIds: string[]) {
  const layers = layerIds.filter((id) => map.getLayer(id));
  return layers.length ? map.queryRenderedFeatures(hitBox(point), { layers }) : [];
}

/**
 * Publishes the right-clicked map point to the store for `MapContextMenu`.
 *
 * Listens to MapLibre's own `contextmenu` event rather than the DOM one:
 * MapLibre defers it to mouse-up and drops it when the right button was used
 * to drag-rotate, on both macOS (where the DOM event fires on mouse-down)
 * and Windows.
 *
 * Call this from the component that owns the map, after `useMapSetup`, so
 * the effect runs once the map exists. A child widget's mount effect runs
 * before the parent's map-creating effect and would see a null ref forever.
 */
export function useMapContextMenu(mapRef: MapRef): void {
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setContextMenuPoint = useMapStore.getState().setContextMenuPoint;

    const handleContextMenu = (e: maplibregl.MapMouseEvent) => {
      // While a measurement is being placed, a right-click ends it instead of opening the menu.
      const measure = useMeasureStore.getState();
      if (measure.placing) {
        if (!measure.finish()) measure.cancel();
        return;
      }
      const elev = map.getTerrain() ? map.queryTerrainElevation(e.lngLat) : null;

      // A measurement started here attaches to the first navaid, plan waypoint or airport under the cursor.
      let snap = null;
      let longitude = e.lngLat.lng;
      let latitude = e.lngLat.lat;
      for (const layerId of MEASURE_SNAP_LAYER_IDS) {
        const feature = featuresAt(map, e.point, [layerId])[0];
        if (!feature || feature.geometry.type !== 'Point') continue;
        snap = snapFromFeature(layerId, feature.properties ?? {});
        const [lon, lat] = feature.geometry.coordinates;
        if (snap && lon !== undefined && lat !== undefined) {
          longitude = lon;
          latitude = lat;
          break;
        }
      }
      const vertex = featuresAt(map, e.point, [MEASURE_VERTEX_HITBOX_LAYER_ID])[0];
      const vertexIndex = vertex?.properties?.index;
      const onMeasureLine = featuresAt(map, e.point, [MEASURE_HITBOX_LAYER_ID]).length > 0;

      setContextMenuPoint({
        longitude,
        latitude,
        x: e.point.x,
        y: e.point.y,
        elevationM: typeof elev === 'number' && Number.isFinite(elev) ? elev : null,
        snap,
        onMeasureLine: onMeasureLine || typeof vertexIndex === 'number',
        measureVertexIndex: typeof vertexIndex === 'number' ? vertexIndex : null,
      });
    };
    const close = () => {
      if (useMapStore.getState().contextMenuPoint) setContextMenuPoint(null);
    };

    map.on('contextmenu', handleContextMenu);
    map.on('movestart', close);
    return () => {
      map.off('contextmenu', handleContextMenu);
      map.off('movestart', close);
      close();
    };
  }, [mapRef]);
}
