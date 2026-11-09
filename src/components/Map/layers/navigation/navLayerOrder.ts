import type * as maplibregl from 'maplibre-gl';
import { overlayLayerBeforeId } from '../types';

/** Airspace shapes sit under the airport; their labels keep their place. */
const AIRSPACE_SHAPE_LAYER_IDS = [
  'nav-airspaces-fill',
  'nav-airspaces-outline',
  'nav-airspaces-outline-dashed',
  'nav-global-airspace-lines',
];

/** The ILS course, antenna and label sit over the airport, under traffic. */
const ILS_LAYER_IDS = ['nav-ils-course', 'nav-ils', 'nav-ils-labels'];

/** The selected airport's own layers; `airport-labels` is the world layer. */
export function isAirportLayerId(id: string): boolean {
  return id.startsWith('airport-') && id !== 'airport-labels';
}

/** Move `id` to sit right before `beforeId` (or on top), only when it is not already there. */
function moveIfNeeded(map: maplibregl.Map, id: string, beforeId: string | undefined): void {
  const order = map.getLayersOrder();
  const target = beforeId ? order.indexOf(beforeId) : order.length;
  if (target < 0) return;
  if (order.indexOf(id) === target - 1) return;
  map.moveLayer(id, beforeId);
}

/** Stack `ids` in that order, the last one right before `beforeId` (or on top). */
function stackBefore(map: maplibregl.Map, ids: string[], beforeId: string | undefined): void {
  let anchor = beforeId;
  for (const id of [...ids].reverse()) {
    if (!map.getLayer(id)) continue;
    moveIfNeeded(map, id, anchor);
    anchor = id;
  }
}

/**
 * Keep the nav layers where a pilot expects them: airspace fills under the
 * selected airport, the ILS over it and under the traffic overlays. Layers
 * are added in whatever order their data arrives, so the first airspace
 * fill after a selection landed on top of the runways and hid the ILS.
 * Idempotent and silent when the order is already right, so it can run
 * after every airport render and nav update without churning the style.
 */
export function ensureNavLayerOrder(map: maplibregl.Map): void {
  if (!map.getStyle()) return;
  const firstAirportLayer = map.getLayersOrder().find(isAirportLayerId);
  if (firstAirportLayer) stackBefore(map, AIRSPACE_SHAPE_LAYER_IDS, firstAirportLayer);
  stackBefore(map, ILS_LAYER_IDS, overlayLayerBeforeId(map));
}
