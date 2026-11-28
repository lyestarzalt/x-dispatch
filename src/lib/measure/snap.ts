import { haversineDistance } from '@/lib/utils/geomath';
import type { MeasurePoint } from '@/stores/measureStore';
import type { MeasureSnap, MeasureSnapKind } from './measureLabel';

/**
 * Layers whose features a measurement or the right-click menu snaps to, in
 * hit priority order. Each one's features carry their exact `latitude` and
 * `longitude` as properties (see `snapAt`).
 */
export const MEASURE_SNAP_LAYER_IDS = [
  'nav-navaids',
  'nav-procedure-navaids',
  'flightplan-waypoints',
  'procedure-waypoints',
  'airports-hitbox',
];

const NAVAID_LAYER_IDS = new Set(['nav-navaids', 'nav-procedure-navaids']);

const NAVAID_KIND: Record<string, MeasureSnapKind> = {
  VOR: 'vor',
  'VOR-DME': 'vor',
  VORTAC: 'vor',
  NDB: 'ndb',
  DME: 'dme',
  TACAN: 'dme',
};

/**
 * The anchor a measurement attaches to, from a rendered feature's layer and
 * properties. Null when the feature is not something a line can start on.
 */
export function snapFromFeature(
  layerId: string,
  props: Record<string, unknown>
): MeasureSnap | null {
  if (NAVAID_LAYER_IDS.has(layerId)) {
    const kind = typeof props.type === 'string' ? NAVAID_KIND[props.type] : undefined;
    const id = typeof props.id === 'string' ? props.id : '';
    if (!kind || !id) return null;
    const freq = typeof props.freqDisplay === 'string' ? props.freqDisplay : '';
    const snap: MeasureSnap = { kind, label: freq ? `${id} ${freq}` : id };
    const variation = props.magneticVariation;
    if (
      kind === 'vor' &&
      typeof variation === 'number' &&
      Number.isFinite(variation) &&
      variation !== 0
    ) {
      snap.magneticVariation = variation;
    }
    return snap;
  }
  if (layerId === 'flightplan-waypoints') {
    return typeof props.label === 'string' && props.label
      ? { kind: 'waypoint', label: props.label }
      : null;
  }
  if (layerId === 'procedure-waypoints') {
    return typeof props.id === 'string' && props.id ? { kind: 'waypoint', label: props.id } : null;
  }
  if (layerId === 'airports-hitbox') {
    return typeof props.icao === 'string' && props.icao
      ? { kind: 'airport', label: props.icao }
      : null;
  }
  return null;
}

/** A rendered feature under the cursor and the layer it was drawn by. */
export interface SnapHit {
  layerId: string;
  feature: { properties: Record<string, unknown> | null };
}

/**
 * The anchor among the features under the cursor, by layer priority, with its
 * exact position. The position comes from the feature's `latitude`/`longitude`
 * properties: `queryRenderedFeatures` rebuilds geometry from tile units (8192
 * per tile), up to 0.16' off at zoom 3, which an INS rejects. Within a layer
 * the anchor nearest `cursor` wins, since at low zoom neighbouring symbols
 * overlap the hit box and MapLibre's order says nothing about distance.
 */
export function snapAt(
  hits: SnapHit[],
  cursor?: MeasurePoint
): { snap: MeasureSnap; point: MeasurePoint } | null {
  for (const layerId of MEASURE_SNAP_LAYER_IDS) {
    let best: { snap: MeasureSnap; point: MeasurePoint } | null = null;
    let bestDistance = Infinity;
    for (const hit of hits) {
      if (hit.layerId !== layerId) continue;
      const props = hit.feature.properties ?? {};
      const { latitude, longitude } = props;
      if (typeof latitude !== 'number' || typeof longitude !== 'number') continue;
      const snap = snapFromFeature(layerId, props);
      if (!snap) continue;
      const distance = cursor
        ? haversineDistance(cursor.latitude, cursor.longitude, latitude, longitude)
        : 0;
      if (distance < bestDistance) {
        best = { snap, point: { latitude, longitude } };
        bestDistance = distance;
      }
    }
    if (best) return best;
  }
  return null;
}
