import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { AirportParser } from '@/lib/parsers/apt';
import type { ParsedAirport } from '@/types/apt';
import { LayerVisibility } from '@/types/layers';
import { LayerRenderer, createLayerRenderers } from '../layers';
import { calculateOptimalZoom } from '../utils/zoomCalculator';

// Map layer IDs to visibility keys
// NOTE: Taxiway lights are now rendered via deck.gl overlay, not MapLibre layers
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
  'airport-signs': 'signs',
  'airport-signs-direction': 'signs',
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
   * Problem: TaxiwayLightsLayer's animation calls setPaintProperty() every
   * frame, which keeps style._changed = true. MapLibre's isStyleLoaded()
   * checks !style._changed, so it returns false permanently while the
   * animation runs. This means safeRemove NEVER executes synchronously —
   * it always defers. But 'idle' also never fires because the animation
   * keeps dirtying the style. Result: old airport sources are never removed,
   * they accumulate (20 sources × 10-16MB each), and by the 2nd-3rd airport
   * switch the map stalls completely (black screen, no basemap tiles).
   *
   * Fix: bypass safeRemove entirely. Collect all layer/source IDs from the
   * renderer metadata and remove them directly. Individual try/catch ensures
   * one failure doesn't block others. Layers must be removed before their
   * sources (MapLibre throws if a source still has referencing layers).
   *
   * See also: TaxiwayLightsLayer.render() which defers its animation start
   * to map.once('idle') for the same reason.
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
      if (!map.current) return null;

      // Toggle off: clicking the same airport deselects it
      if (selectedAirport.current === icao) {
        clearAirport();
        return null;
      }

      // Clear previous airport layers before adding new ones
      clearAirport();

      const result = await window.airportAPI.getAirportData(icao);
      if (!result) return null;

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

      // Render all layers synchronously in one batch
      for (const renderer of layerRenderers.current) {
        if (renderer.hasData(parsedAirport)) {
          try {
            const result = renderer.render(map.current, parsedAirport);
            if (result instanceof Promise) {
              result.catch((err) =>
                window.appAPI.log.error(`Layer ${renderer.layerId} async failed for ${icao}`, err)
              );
            }
          } catch (err) {
            window.appAPI.log.error(`Layer ${renderer.layerId} render failed for ${icao}`, err);
          }
        }
      }

      const optimalZoom = calculateOptimalZoom(parsedAirport.runways);

      map.current.flyTo({
        center,
        zoom: optimalZoom,
        duration: 2000,
      });

      selectedAirport.current = icao;
      return parsedAirport;
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
   * when the map was idle (#59). Same root cause as the TaxiwayLightsLayer
   * issue (see TaxiwayLightsLayer.ts and clearAirport above).
   *
   * All airport lights now render at static opacity. The rabbit effect
   * looked nice but isn't worth the battery drain on laptops.
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
