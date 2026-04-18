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

  // Animation removed — setPaintProperty on every frame caused 50-80% GPU (#59)
  // and blocked isStyleLoaded(), causing airport switching black screen.
  // Lights render at static opacity now.

  hasData(airport: ParsedAirport): boolean {
    return airport.linearFeatures && airport.linearFeatures.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

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

    // Animation disabled — setPaintProperty() on every frame/interval causes
    // MapLibre to repaint continuously, using 50-80% GPU even when idle (#59).
    // Stop bar lights are rendered at static opacity instead.
    // See useAirportRenderer.ts clearAirport() for related safeRemove bypass.
  }

  /**
   * Animate pulsating stop bar lights by modulating opacity.
   * Throttled to ~10fps to reduce GPU/power usage (issue #59).
   * Pauses when zoomed out past light visibility threshold.
   */
  protected performRemove(map: maplibregl.Map): void {
    super.performRemove(map);
  }
}
