import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { AirportParser } from '@/lib/parsers/apt';
import { setActiveBezierResolution } from '@/lib/parsers/apt/bezier';
import { useSettingsStore } from '@/stores/settingsStore';
import type { ParsedAirport } from '@/types/apt';
import { LayerVisibility } from '@/types/layers';
import { LayerRenderer, createLayerRenderers } from '../layers';
import { calculateOptimalZoom } from '../utils/zoomCalculator';

// Map layer IDs to visibility keys.
const LAYER_VISIBILITY_MAP: Record<string, keyof LayerVisibility> = {
  'airport-runways': 'runways',
  'airport-runway-centerlines': 'runways',
  'airport-runway-labels': 'runways',
  'airport-runway-markings': 'runwayMarkings',
  'airport-runway-numbers': 'runwayMarkings',
  'airport-runway-threshold-bars': 'runwayMarkings',
  'airport-runway-aiming-points': 'runwayMarkings',
  'airport-runway-tdz-marks': 'runwayMarkings',
  'airport-runway-edge-lights': 'runwayLights',
  'airport-runway-threshold-lights': 'runwayLights',
  'airport-runway-centerline-lights': 'runwayLights',
  'airport-runway-end-lights': 'runwayLights',
  'airport-approach-lights': 'approachLights',
  'airport-taxiways': 'taxiways',
  'airport-linear-features': 'linearFeatures',
  'airport-linear-features-border': 'linearFeatures',
  'airport-linear-features-centerline': 'linearFeatures',
  'airport-linear-features-centerline-border': 'linearFeatures',
  'airport-gates': 'gates',
  'airport-gate-labels': 'gates',
  'airport-windsocks': 'windsocks',
  'airport-windsock-labels': 'windsocks',
  'airport-boundaries': 'boundaries',
  'airport-pavements': 'pavements',
};

interface UseAirportRendererResult {
  renderAirport: (icao: string, center: [number, number]) => Promise<ParsedAirport | null>;
  clearAirport: () => void;
  selectedAirport: React.MutableRefObject<string | null>;
  setLayerVisibility: (visibility: LayerVisibility) => void;
  startAnimations: () => void;
  stopAnimations: () => void;
}

/**
 * Hook to manage airport rendering on the map
 */
export function useAirportRenderer(
  map: React.MutableRefObject<maplibregl.Map | null>,
  _isNightMode = false
): UseAirportRendererResult {
  const layerRenderers = useRef<LayerRenderer[]>(createLayerRenderers());
  const selectedAirport = useRef<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const animationsEnabled = useRef(true);

  /**
   * Clear all airport feature layers from the map.
   *
   * Why this doesn't use renderer.remove():
   * BaseLayerRenderer.remove() delegates to safeRemove(), which checks
   * map.isStyleLoaded(). If false, removal is deferred to the 'idle' event.
   *
   * Problem: any per-frame setPaintProperty() (e.g. an old animation loop)
   * keeps style._changed = true. MapLibre's isStyleLoaded() checks
   * !style._changed, so it returns false permanently while such an animation
   * runs. safeRemove NEVER executes synchronously then — it always defers to
   * 'idle', which also never fires. Result: old airport sources accumulate
   * (20 sources × 10-16MB each), and by the 2nd-3rd airport switch the map
   * stalls (black screen, no basemap tiles).
   *
   * Fix: bypass safeRemove entirely. Collect all layer/source IDs from the
   * renderer metadata and remove them directly. Individual try/catch ensures
   * one failure doesn't block others. Layers must be removed before their
   * sources (MapLibre throws if a source still has referencing layers).
   */
  const clearAirport = useCallback(() => {
    const m = map.current;
    if (!m || !m.getStyle()) return;

    // Collect all layer and source IDs from the renderers
    const renderers = layerRenderers.current;
    const layerIds: string[] = [];
    const sourceIds: string[] = [];

    for (const renderer of renderers) {
      if (renderer.additionalLayerIds) layerIds.push(...renderer.additionalLayerIds);
      layerIds.push(renderer.layerId);
      if (renderer.additionalSourceIds) sourceIds.push(...renderer.additionalSourceIds);
      sourceIds.push(renderer.sourceId);
    }

    // Remove layers first (reverse order), then sources
    for (const id of layerIds.reverse()) {
      try {
        if (m.getLayer(id)) m.removeLayer(id);
      } catch {
        /* Style may be mid-transition — safe to ignore */
      }
    }
    for (const id of sourceIds) {
      try {
        if (m.getSource(id)) m.removeSource(id);
      } catch {
        /* Source may have dangling layer refs — safe to ignore */
      }
    }

    selectedAirport.current = null;
  }, [map]);

  const renderAirport = useCallback(
    async (icao: string, center: [number, number]): Promise<ParsedAirport | null> => {
      const m = map.current;
      if (!m) return null;

      const paintLayers = (parsedAirport: ParsedAirport): void => {
        for (const renderer of layerRenderers.current) {
          // Map may have been destroyed between layer calls (component unmount
          // or basemap rebuild mid-paint). MapLibre nulls `style` on remove(),
          // so subsequent `getSource()` / `getImage()` calls inside a renderer
          // throw "Cannot read properties of null". Sentry X-DISPATCH-13 /
          // X-DISPATCH-14 traced to exactly this cascade — bail rather than
          // log a noise event per remaining layer.
          if (!m.getStyle()) return;
          if (!renderer.hasData(parsedAirport)) continue;
          try {
            const renderResult = renderer.render(m, parsedAirport);
            if (renderResult instanceof Promise) {
              renderResult.catch((err) =>
                window.appAPI.log.error(`Layer ${renderer.layerId} async failed for ${icao}`, err)
              );
            }
          } catch (err) {
            window.appAPI.log.error(`Layer ${renderer.layerId} render failed for ${icao}`, err);
          }
        }
      };

      const doRender = async (): Promise<ParsedAirport | null> => {
        // Toggle off: clicking the same airport deselects it
        if (selectedAirport.current === icao) {
          clearAirport();
          return null;
        }

        // Clear previous airport layers before adding new ones
        clearAirport();

        const result = await window.airportAPI.getAirportData(icao);
        if (!result) return null;

        // Apply surface detail setting before parsing
        const { surfaceDetail } = useSettingsStore.getState().graphics;
        setActiveBezierResolution(surfaceDetail);

        const parser = new AirportParser(result.data);
        const { data: parsedAirport, errors, stats } = parser.parse();

        // Enrich with coordinates and source file path
        parsedAirport.longitude = center[0];
        parsedAirport.latitude = center[1];
        parsedAirport.sourceFile = result.sourceFile;

        if (errors.length > 0) {
          window.appAPI.log.warn(
            `AirportParser ${icao}: ${errors.length} errors, ${stats.skipped} skipped`
          );
        }

        // Note on Sentry X-DISPATCH-1C / X-DISPATCH-16 ("Style is not done
        // loading"): an attempt to gate this on `isStyleLoaded()` here broke
        // the home-airport autoload on cold start, because that helper
        // returns false during normal tile loading (sourceCache.loaded()) —
        // not just during a setStyle. addLayer/addSource only need
        // `style._loaded`, which is true once `style.load` has fired. The
        // per-layer try/catch below already catches the rare setStyle race
        // and logs one event per affected layer; living with that noise is
        // better than a silent paint-never-fires regression.
        paintLayers(parsedAirport);

        const optimalZoom = calculateOptimalZoom(parsedAirport.runways);

        m.flyTo({
          center,
          zoom: optimalZoom,
          duration: 2000,
        });

        selectedAirport.current = icao;
        return parsedAirport;
      };

      // Defer until the style is fully loaded. Each renderer's `render()`
      // calls `addSource` / `addLayer`, which throw "Style is not done
      // loading" while `style._loaded` is false. The cold-start home-
      // airport autoload race (`App.tsx` fires `requestSelectAirport`
      // when appState reaches 'ready', which can land before
      // `map.on('load')` resolves) hits this path and floods the log
      // with one swallowed error per layer.
      if (!m.isStyleLoaded()) {
        return new Promise<ParsedAirport | null>((resolve) => {
          m.once('style.load', () => {
            doRender().then(resolve);
          });
        });
      }
      return doRender();
    },
    [map, clearAirport]
  );

  /**
   * Set visibility for layers based on toggle state
   */
  const setLayerVisibility = useCallback(
    (visibility: LayerVisibility) => {
      if (!map.current) return;

      Object.entries(LAYER_VISIBILITY_MAP).forEach(([layerId, visibilityKey]) => {
        if (map.current?.getLayer(layerId)) {
          const isVisible = visibility[visibilityKey];
          map.current.setLayoutProperty(layerId, 'visibility', isVisible ? 'visible' : 'none');
        }
      });

      animationsEnabled.current = visibility.animations;
    },
    [map]
  );

  /**
   * Start light animations — DISABLED
   *
   * The approach lights "rabbit" animation used setPaintProperty() at 30fps,
   * which caused MapLibre to repaint every frame → 50-80% GPU usage even
   * when the map was idle (#59). See clearAirport above for the related
   * cleanup hazard.
   *
   * All airport lights now render at static opacity. The rabbit effect
   * lives in `useApproachLightAnimation` as a Canvas2D overlay instead.
   */
  const startAnimations = useCallback(() => {
    // No-op — animations removed for GPU performance (#59)
  }, []);

  /**
   * Stop animations
   */
  const stopAnimations = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopAnimations();
    };
  }, [stopAnimations]);

  return {
    renderAirport,
    clearAirport,
    selectedAirport,
    setLayerVisibility,
    startAnimations,
    stopAnimations,
  };
}
