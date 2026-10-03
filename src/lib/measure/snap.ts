import type { MeasureSnap, MeasureSnapKind } from './measureLabel';

/** Layers whose features a measurement can start on, in hit priority order. */
export const MEASURE_SNAP_LAYER_IDS = ['nav-navaids', 'flightplan-waypoints', 'airports-hitbox'];

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
  if (layerId === 'nav-navaids') {
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
  if (layerId === 'airports-hitbox') {
    return typeof props.icao === 'string' && props.icao
      ? { kind: 'airport', label: props.icao }
      : null;
  }
  return null;
}
