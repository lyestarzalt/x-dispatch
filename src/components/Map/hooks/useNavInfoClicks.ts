import { type RefObject, useEffect } from 'react';
import type * as maplibregl from 'maplibre-gl';
import { useMapStore } from '@/stores/mapStore';
import { NAV_INFO_LAYER_IDS, navInfoFromFeature } from '../navInfo';

type FeatureEvent = maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] };

/** Opens the navaid / waypoint info popup when one is clicked on the map. */
export function useNavInfoClicks(mapRef: RefObject<maplibregl.Map | null>): void {
  const setNavInfo = useMapStore((s) => s.setNavInfo);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onClick = (e: FeatureEvent) => {
      const feature = e.features?.[0];
      if (!feature || feature.geometry.type !== 'Point') return;
      const [lng, lat] = feature.geometry.coordinates;
      if (lng === undefined || lat === undefined) return;
      const info = navInfoFromFeature(feature.layer.id, feature.properties ?? {}, lat, lng);
      if (info) setNavInfo(info);
    };
    const onEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const onLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    for (const layerId of NAV_INFO_LAYER_IDS) {
      map.on('click', layerId, onClick);
      map.on('mouseenter', layerId, onEnter);
      map.on('mouseleave', layerId, onLeave);
    }
    return () => {
      for (const layerId of NAV_INFO_LAYER_IDS) {
        map.off('click', layerId, onClick);
        map.off('mouseenter', layerId, onEnter);
        map.off('mouseleave', layerId, onLeave);
      }
    };
  }, [mapRef, setNavInfo]);
}
