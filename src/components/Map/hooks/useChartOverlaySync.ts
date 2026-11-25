import { useEffect, useRef } from 'react';
import type * as maplibregl from 'maplibre-gl';
import type { ChartInk } from '@/lib/chartOverlay/pixels';
import { type RenderedChart, renderChart } from '@/lib/chartOverlay/renderChart';
import type { BasemapTheme } from '@/lib/map/basemapTheme';
import { errorMessage } from '@/lib/utils/errors';
import logger from '@/lib/utils/loggerRenderer';
import { useFaaChartPdf } from '@/queries';
import { useChartOverlayStore } from '@/stores/chartOverlayStore';
import {
  isChartOverlayOnMap,
  removeChartOverlay,
  setChartOverlayOpacity,
  showChartOverlay,
} from '../layers/dynamic/ChartOverlayLayer';
import { isMapRemoved } from '../layers/types';
import { groundOverlayBeforeId } from '../utils/globeUtils';
import { isStyleReadyForLayerUpdates, runWhenStyleIsReady } from './styleReadiness';
import type { MapRef } from './useMapSetup';

interface UseChartOverlaySyncOptions {
  mapRef: MapRef;
  theme: BasemapTheme;
}

/** A night sheet on a dark basemap and on imagery; the chart as printed on a light basemap. */
function inkFor(theme: BasemapTheme): ChartInk {
  return theme === 'dark' || theme === 'satellite' ? 'light' : 'dark';
}

function fitChart(map: maplibregl.Map, corners: RenderedChart['corners']): void {
  const lons = corners.map((c) => c[0]);
  const lats = corners.map((c) => c[1]);
  map.fitBounds(
    [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    { padding: 60, duration: 1000 }
  );
}

/**
 * Keeps the map's chart overlay in step with the chart the pilot picked: fetches the PDF,
 * draws it, lays it on the map and moves the camera to it once. The chart is put
 * back after a basemap change, which cannot carry a canvas source over.
 */
export function useChartOverlaySync({ mapRef, theme }: UseChartOverlaySyncOptions): void {
  const chart = useChartOverlayStore((s) => s.chart);
  const setShown = useChartOverlayStore((s) => s.setShown);
  const setError = useChartOverlayStore((s) => s.setError);
  // `dataUpdatedAt` moves on every fetch, so a retry that fails the same way is still seen.
  const { data, dataUpdatedAt } = useFaaChartPdf(chart?.url ?? null);
  const ink = inkFor(theme);
  const url = chart?.url ?? null;

  /** The chart on the map, kept to lay it again after a style change. */
  const shownRef = useRef<RenderedChart | null>(null);
  /** The chart the camera last moved to: a new ink color does not move it again. */
  const fittedUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!url) {
      shownRef.current = null;
      fittedUrlRef.current = null;
      removeChartOverlay(map);
      return;
    }
    if (!data) return;
    if ('error' in data) {
      shownRef.current = null;
      removeChartOverlay(map);
      setError(url, data.error === 'network' ? 'network' : 'unavailable');
      return;
    }

    let cancelled = false;
    let stopWaiting: (() => void) | undefined;
    renderChart(data.pdf, ink)
      .then((rendered) => {
        if (cancelled || isMapRemoved(map)) return;
        stopWaiting = runWhenStyleIsReady(map, () => {
          shownRef.current = rendered;
          showChartOverlay(
            map,
            rendered.canvas,
            rendered.corners,
            useChartOverlayStore.getState().opacity,
            groundOverlayBeforeId(map)
          );
          setShown(url);
          if (fittedUrlRef.current !== url) {
            fittedUrlRef.current = url;
            // This can run inside a style event; the camera moves after it.
            setTimeout(() => {
              if (!isMapRemoved(map)) fitChart(map, rendered.corners);
            }, 0);
          }
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        logger.map.warn(`Chart overlay ${url} could not be drawn: ${errorMessage(error)}`);
        shownRef.current = null;
        if (!isMapRemoved(map)) removeChartOverlay(map);
        setError(url, 'unplaceable');
      });
    return () => {
      cancelled = true;
      stopWaiting?.();
    };
  }, [mapRef, url, data, dataUpdatedAt, ink, setShown, setError]);

  // The slider writes straight to the layer. Reading the opacity as React state here would
  // render the whole map component on every step of a drag, and the chart lagged behind.
  useEffect(
    () =>
      useChartOverlayStore.subscribe((state, previous) => {
        const map = mapRef.current;
        if (map && state.opacity !== previous.opacity) setChartOverlayOpacity(map, state.opacity);
      }),
    [mapRef]
  );

  // A basemap change drops the canvas source; lay the chart again once the new style is in.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const restore = () => {
      const shown = shownRef.current;
      if (!shown || isChartOverlayOnMap(map) || !isStyleReadyForLayerUpdates(map)) return;
      showChartOverlay(
        map,
        shown.canvas,
        shown.corners,
        useChartOverlayStore.getState().opacity,
        groundOverlayBeforeId(map)
      );
    };
    map.on('styledata', restore);
    return () => {
      map.off('styledata', restore);
    };
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    return () => {
      if (map && !isMapRemoved(map)) removeChartOverlay(map);
    };
  }, [mapRef]);
}
