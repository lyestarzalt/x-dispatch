import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { localizeBasemapLabels } from '@/lib/map/basemapLabels';
import type { MapRef } from './useMapSetup';

/**
 * Shows basemap place names in the UI language. Runs on the current style and
 * again after every style switch, which resets the layers to the provider's English.
 */
export function useBasemapLabelLanguage(mapRef: MapRef): void {
  const { i18n } = useTranslation();
  const language = i18n.language;

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = () => {
      if (!mapRef.current) return;
      try {
        localizeBasemapLabels(map, language);
      } catch (err) {
        window.appAPI?.log?.warn?.('Basemap label language not applied', err);
      }
    };

    if (map.getStyle()?.layers?.length) apply();
    map.on('style.load', apply);
    return () => {
      map.off('style.load', apply);
    };
  }, [mapRef, language]);
}
