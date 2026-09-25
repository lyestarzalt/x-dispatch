import type * as maplibregl from 'maplibre-gl';
import { type NavInfoSelection, useMapStore } from '@/stores/mapStore';

export const NAV_INFO_LAYER_IDS = ['nav-navaids', 'flightplan-waypoints'];

type FeatureEvent = maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] };

/**
 * Opens the info card when a navaid or plan waypoint is clicked. Registered per map instance,
 * since the map is rebuilt when the airport list loads; layers missing at the time are skipped
 * by MapLibre's delegated listeners until they exist.
 */
export function setupNavInfoClicks(map: maplibregl.Map): void {
  map.on('click', NAV_INFO_LAYER_IDS, (e: FeatureEvent) => {
    const feature = e.features?.[0];
    if (!feature || feature.geometry.type !== 'Point') return;
    const [lng, lat] = feature.geometry.coordinates;
    if (lng === undefined || lat === undefined) return;
    const info = navInfoFromFeature(feature.layer.id, feature.properties ?? {}, lat, lng);
    if (info) useMapStore.getState().setNavInfo(info);
  });
  map.on('mouseenter', NAV_INFO_LAYER_IDS, () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', NAV_INFO_LAYER_IDS, () => {
    map.getCanvas().style.cursor = '';
  });
}

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
