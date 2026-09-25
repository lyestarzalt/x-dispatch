import type { NavInfoSelection } from '@/stores/mapStore';

export const NAV_INFO_LAYER_IDS = ['nav-navaids', 'flightplan-waypoints'];

const FMS_NDB = 2;
const FMS_VOR = 3;

/** Popup content for a clicked feature of the navaid or flight plan waypoint layer. */
export function navInfoFromFeature(
  layerId: string,
  props: Record<string, unknown>,
  latitude: number,
  longitude: number
): NavInfoSelection | null {
  const id = typeof props.id === 'string' ? props.id : '';
  if (!id) return null;
  if (layerId === 'nav-navaids') {
    const type = String(props.type ?? '');
    const freq = String(props.freqDisplay ?? '');
    return {
      id,
      name: typeof props.name === 'string' ? props.name : undefined,
      kind: type,
      frequency: type === 'NDB' ? freq : `${freq} MHz`,
      latitude,
      longitude,
    };
  }
  const navType = Number(props.navType);
  const frequency = Number(props.frequency);
  const altitudeLabel = typeof props.altitudeLabel === 'string' ? props.altitudeLabel : '';
  let kind = 'WPT';
  let freqLabel: string | undefined;
  if (navType === FMS_NDB) {
    kind = 'NDB';
    if (frequency > 0) freqLabel = `${frequency} kHz`;
  } else if (navType === FMS_VOR) {
    kind = 'VOR';
    if (frequency > 0) freqLabel = `${frequency.toFixed(2)} MHz`;
  }
  return {
    id,
    kind,
    frequency: freqLabel,
    altitudeLabel: altitudeLabel || undefined,
    latitude,
    longitude,
  };
}
