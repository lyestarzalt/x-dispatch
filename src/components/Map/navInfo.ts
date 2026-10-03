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
    const elevation = Number(props.elevation);
    return {
      id,
      name: typeof props.name === 'string' ? props.name : undefined,
      kind: type,
      frequency: type === 'NDB' ? freq : `${freq} MHz`,
      elevationFt: Number.isFinite(elevation) ? elevation : undefined,
      latitude,
      longitude,
    };
  }
  const navType = Number(props.navType);
  const frequency = Number(props.frequency);
  const altitudeLabel = typeof props.altitudeLabel === 'string' ? props.altitudeLabel : '';
  const index = Number(props.index);
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
    routeIndex: Number.isInteger(index) && index >= 0 ? index : undefined,
    latitude,
    longitude,
  };
}

/** Degrees within which a clicked navaid counts as the plan waypoint of the same id. */
const SAME_FIX_DEG = 0.01;

/**
 * Planned altitude over the selection from the route's vertical profile, feet. A plan waypoint
 * carries its index; a navaid clicked on its own layer is matched to the route by id and position.
 */
export function plannedAltitudeFt(
  info: NavInfoSelection,
  waypoints: readonly { id: string; latitude: number; longitude: number }[],
  altitudesFt: readonly number[]
): number | null {
  const index =
    info.routeIndex ??
    waypoints.findIndex(
      (wp) =>
        wp.id === info.id &&
        Math.abs(wp.latitude - info.latitude) < SAME_FIX_DEG &&
        Math.abs(wp.longitude - info.longitude) < SAME_FIX_DEG
    );
  const altitude = altitudesFt[index];
  return altitude !== undefined && Number.isFinite(altitude) ? altitude : null;
}
