import { useEffect, useRef } from 'react';
import type maplibregl from 'maplibre-gl';
import type { AirportGeorefInput } from '@/lib/sia/georef';
import { useAppStore } from '@/stores/appStore';
import { useMapStore } from '@/stores/mapStore';
import type { ParsedAirport } from '@/types/apt';
import type { MapRef } from './useMapSetup';

const SOURCE_ID = 'vac-overlay';
const LAYER_ID = 'vac-overlay-raster';

function buildGeorefInput(airport: ParsedAirport): AirportGeorefInput {
  const runways = airport.runways
    ?.map((r) => {
      const ends = r.ends ?? [];
      const e0 = ends[0];
      const e1 = ends[1] ?? ends[0];
      if (!e0 || !e1) return null;
      return {
        lat1: e0.latitude,
        lon1: e0.longitude,
        lat2: e1.latitude,
        lon2: e1.longitude,
        lengthM: 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { lat: airport.latitude, lon: airport.longitude, runways };
}

function removeVacOverlay(map: maplibregl.Map): void {
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export function useVacOverlaySync(mapRef: MapRef): void {
  const enabled = useMapStore((s) => s.vacOverlayEnabled);
  const icao = useAppStore((s) => s.selectedICAO);
  const airport = useAppStore((s) => s.selectedAirportData);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!enabled || !icao || !airport) {
      removeVacOverlay(map);
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      return;
    }

    let cancelled = false;

    void (async () => {
      const georef = buildGeorefInput(airport);
      const info = await window.siaAPI.getVacForIcao(icao, georef);
      if (cancelled || !info?.georef) return;

      const png = await window.siaAPI.renderVacPng(icao);
      if (!png?.length || cancelled) return;
      const blob = new Blob([Uint8Array.from(png)], { type: 'image/png' });
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      const imageUrl = urlRef.current;

      if (cancelled) return;

      removeVacOverlay(map);
      map.addSource(SOURCE_ID, {
        type: 'image',
        url: imageUrl,
        coordinates: info.georef.coordinates,
      });
      map.addLayer({
        id: LAYER_ID,
        type: 'raster',
        source: SOURCE_ID,
        paint: { 'raster-opacity': 0.85 },
      });
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) removeVacOverlay(mapRef.current);
    };
  }, [mapRef, enabled, icao, airport]);
}
