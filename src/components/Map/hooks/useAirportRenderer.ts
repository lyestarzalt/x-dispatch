import { useCallback, useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { AirportParser, ParsedAirport } from '@/lib/aptParser';
import { LayerVisibility } from '@/types/layers';
import { LayerRenderer, createLayerRenderers } from '../layers';
import { calculateAirportCenter, calculateOptimalZoom } from '../utils/zoomCalculator';

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
  renderAirport: (icao: string) => Promise<ParsedAirport | null>;
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
   * Clear all airport feature layers from the map
   */
  const clearAirport = useCallback(() => {
    if (!map.current) return;

    const renderers = [...layerRenderers.current].reverse();
    for (const renderer of renderers) {
      renderer.remove(map.current);
    }

    selectedAirport.current = null;
  }, [map]);

  /**
   * Render airport features on the map
   */
  const renderAirport = useCallback(
    async (icao: string): Promise<ParsedAirport | null> => {
      if (!map.current) return null;

      if (selectedAirport.current === icao) {
        clearAirport();
        return null;
      }

      clearAirport();

      const data = await window.airportAPI.getAirportData(icao);
      if (!data) return null;

      const parser = new AirportParser(data);
      const parsedAirport = parser.parse();

      for (const renderer of layerRenderers.current) {
        if (renderer.hasData(parsedAirport)) {
          renderer.render(map.current, parsedAirport);
        }
      }

      const optimalZoom = calculateOptimalZoom(parsedAirport.runways);
      const center = calculateAirportCenter(parsedAirport.runways, parsedAirport.metadata);

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
   * Start light animations
   *
   * IMPORTANT: Most airport lights are STEADY in real life!
   * Taxiway lights are now handled by TaxiwayLightsLayer using deck.gl
   * Only approach lights "rabbit" effect is animated here.
   */
  const startAnimations = useCallback(() => {
    if (!map.current) return;

    let phase = 0;
    const animate = () => {
      if (!map.current || !animationsEnabled.current) {
        animationFrameRef.current = null;
        return;
      }

      // phase increments at ~60fps, so 0.016 per frame = ~1 second per 60 frames
      phase += 0.016;

      try {
        // Approach lights "rabbit" effect
        // 30 bars (dist 30-900m, every 30m), barIndex 0=near threshold, 29=far
        // Cycle through all 30 in ~1.5 seconds (20 bars/sec)
        // Light runs from far (29) toward near (0)
        const currentBar = Math.floor((phase * 20) % 30);

        if (map.current.getLayer('airport-approach-lights')) {
          map.current.setPaintProperty('airport-approach-lights', 'circle-opacity', [
            'case',
            // Light up the bar where the "rabbit" currently is (running from far to near)
            ['==', ['get', 'barIndex'], 29 - currentBar],
            1.0,
            // Bars the rabbit has passed (closer to threshold) - bright trail
            ['<', ['get', 'barIndex'], 29 - currentBar],
            0.7,
            // Bars ahead of rabbit (further from threshold) - dim
            0.3,
          ]);

          // Strobe effect - use zoom level to calculate radius dynamically
          const zoom = map.current.getZoom();
          const baseRadius = 1.5 + (zoom - 13) * 0.5;
          const largeRadius = baseRadius * 1.8;

          map.current.setPaintProperty('airport-approach-lights', 'circle-radius', [
            'case',
            ['==', ['get', 'barIndex'], 29 - currentBar],
            largeRadius,
            baseRadius,
          ]);

          // Keep blur steady
          map.current.setPaintProperty('airport-approach-lights', 'circle-blur', 0.4);
        }

        // NOTE: Taxiway lights are handled by TaxiwayLightsLayer (deck.gl)
        // Runway lights remain steady (no animation)
      } catch {
        // Layer might not exist yet
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();
  }, [map]);

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
