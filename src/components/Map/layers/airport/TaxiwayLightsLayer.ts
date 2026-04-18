import maplibregl from 'maplibre-gl';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { LIGHT_COLORS, generateAirportLights } from '@/lib/parsers/apt/lighting';
import type { ParsedAirport } from '@/types/apt';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Taxiway Lights Layer — pure MapLibre circle layers (no deck.gl)
 *
 * Renders taxiway lighting according to FAA standards:
 * - Green centerline lights (101)
 * - Blue edge lights (102)
 * - Amber clearance bars (103)
 * - Amber pulsating stop bars (104)
 * - Alternating amber/green lead-off lights (105, 108)
 * - Red hazard lights (106)
 * - Green runway exit lights (107)
 */
export class TaxiwayLightsLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiway-lights';
  sourceId = 'airport-taxiway-lights';
  additionalLayerIds = ['airport-taxiway-lights-radiation', 'airport-taxiway-lights-glow'];

  private animationTimer: number | null = null;
  private pulsatePhase = 0;
  private map: maplibregl.Map | null = null;

  hasData(airport: ParsedAirport): boolean {
    return airport.linearFeatures && airport.linearFeatures.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    this.map = map;

    const lights = generateAirportLights(airport.linearFeatures);
    if (lights.length === 0) return;

    // Build GeoJSON from lights
    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: lights.map((light, index) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: light.coordinates,
        },
        properties: {
          id: index,
          color: light.color,
          colorHex: LIGHT_COLORS[light.color].hex,
          isPulsating: light.isPulsating,
          intensity: light.intensity,
        },
      })),
    };

    this.addSource(map, geoJSON);

    // Match linearFeatures minZoom so lights appear/disappear with taxiway lines
    const minzoom = ZOOM_BEHAVIORS.linearFeatures?.minZoom ?? 14;

    // Layer 1: Outer radiation — large, very faint, full blur (light spill)
    this.addLayer(map, {
      id: 'airport-taxiway-lights-radiation',
      type: 'circle',
      source: this.sourceId,
      minzoom,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          ['*', 5, ['get', 'intensity']],
          16,
          ['*', 12, ['get', 'intensity']],
          18,
          ['*', 24, ['get', 'intensity']],
        ],
        'circle-color': ['get', 'colorHex'],
        'circle-opacity': 0.03,
        'circle-blur': 1,
      },
    });

    // Layer 2: Mid glow — medium radius, moderate opacity
    this.addLayer(map, {
      id: 'airport-taxiway-lights-glow',
      type: 'circle',
      source: this.sourceId,
      minzoom,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          ['*', 2, ['get', 'intensity']],
          16,
          ['*', 4, ['get', 'intensity']],
          18,
          ['*', 8, ['get', 'intensity']],
        ],
        'circle-color': ['get', 'colorHex'],
        'circle-opacity': 0.1,
        'circle-blur': 0.8,
      },
    });

    // Layer 3: Bright core — tiny, sharp, full brightness
    this.addLayer(map, {
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      minzoom,
      paint: {
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14,
          ['*', 0.4, ['get', 'intensity']],
          16,
          ['*', 0.8, ['get', 'intensity']],
          18,
          ['*', 1.5, ['get', 'intensity']],
        ],
        'circle-color': '#ffffff',
        'circle-opacity': 1,
        'circle-blur': 0.1,
      },
    });

    // IMPORTANT: Defer animation to after MapLibre finishes processing this source.
    //
    // Why: startAnimation() calls setPaintProperty() every frame, which sets
    // style._changed = true. If this runs before MapLibre's tile workers finish
    // processing the GeoJSON, the tile manager stays in _paused state with
    // _didEmitContent = false. This keeps isStyleLoaded() permanently false.
    //
    // Consequence: safeRemove() (used by BaseLayerRenderer.remove()) checks
    // isStyleLoaded() and defers removal when false. With isStyleLoaded stuck
    // on false, old airport layers/sources are NEVER cleaned up on airport
    // switch. They accumulate, eventually blocking all basemap tile loading
    // and causing a black screen.
    //
    // Fix: wait for 'idle' (all sources processed) before starting the RAF loop.
    // See also: useAirportRenderer.ts clearAirport() which bypasses safeRemove
    // entirely for the same reason.
    map.once('idle', () => {
      if (this.map) this.startAnimation();
    });
  }

  /**
   * Animate pulsating stop bar lights by modulating opacity.
   * Throttled to ~10fps to reduce GPU/power usage (issue #59).
   * Pauses when zoomed out past light visibility threshold.
   */
  private startAnimation(): void {
    if (this.animationTimer) return;
    const map = this.map;
    if (!map) return;

    const INTERVAL_MS = 100; // ~10fps — enough for a smooth pulse
    const MIN_ZOOM = ZOOM_BEHAVIORS.linearFeatures?.minZoom ?? 14;

    this.animationTimer = window.setInterval(() => {
      if (!map.getStyle() || !map.getLayer(this.layerId)) {
        this.stopAnimation();
        return;
      }

      // Skip updates when zoomed out — lights aren't visible anyway
      if (map.getZoom() < MIN_ZOOM) return;

      this.pulsatePhase = (this.pulsatePhase + 0.05) % 1;
      const pulse = 0.3 + 0.7 * Math.sin(this.pulsatePhase * Math.PI * 2);

      try {
        map.setPaintProperty(this.layerId, 'circle-opacity', [
          'case',
          ['get', 'isPulsating'],
          pulse,
          1,
        ]);
        map.setPaintProperty('airport-taxiway-lights-glow', 'circle-opacity', [
          'case',
          ['get', 'isPulsating'],
          pulse * 0.1,
          0.1,
        ]);
        map.setPaintProperty('airport-taxiway-lights-radiation', 'circle-opacity', [
          'case',
          ['get', 'isPulsating'],
          pulse * 0.03,
          0.03,
        ]);
      } catch {
        // Layer removed — stop animation
        this.stopAnimation();
      }
    }, INTERVAL_MS);
  }

  private stopAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  protected performRemove(map: maplibregl.Map): void {
    this.stopAnimation();
    this.map = null;
    super.performRemove(map);
  }
}
