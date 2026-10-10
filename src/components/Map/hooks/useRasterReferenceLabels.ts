import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { addReferenceLabels } from '@/lib/map/referenceLabels';
import { isRasterTileUrl } from '@/lib/map/tileUrlToStyle';
import { useSettingsStore } from '@/stores/settingsStore';
import type { MapRef } from './useMapSetup';

/**
 * Lays borders and place names over raster basemaps, which ship without any.
 * The style switch drops the overlay with the old basemap, so it is re-added
 * after every style load while a raster basemap is active, and rebuilt when
 * the user changes which labels show or how they look.
 */
export function useRasterReferenceLabels(mapRef: MapRef, mapStyleUrl: string): void {
  const { i18n } = useTranslation();
  const labelSettings = useSettingsStore((s) => s.map.referenceLabels);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isRasterTileUrl(mapStyleUrl)) return;

    const apply = () => {
      if (!mapRef.current) return;
      addReferenceLabels(map, i18n.language, labelSettings).catch((err) => {
        window.appAPI?.log?.warn?.('Reference labels not added to the raster basemap', err);
      });
    };

    if (map.getStyle()?.layers?.length) apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [mapRef, mapStyleUrl, i18n, labelSettings]);
}
