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
  additionalLayerIds = ['airport-taxiway-lights-glow'];

  private animationFrame: number | null = null;
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

    // Glow layer — soft halo behind each light
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
          ['*', 4, ['get', 'intensity']],
          16,
          ['*', 6, ['get', 'intensity']],
          18,
          ['*', 10, ['get', 'intensity']],
        ],
        'circle-color': ['get', 'colorHex'],
        'circle-opacity': 0.15,
        'circle-blur': 1,
      },
    });

    // Main light layer — visible colored dot
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
          ['*', 1.5, ['get', 'intensity']],
          16,
          ['*', 3, ['get', 'intensity']],
          18,
          ['*', 5, ['get', 'intensity']],
        ],
        'circle-color': ['get', 'colorHex'],
        'circle-opacity': 0.95,
        'circle-blur': 0.3,
      },
    });

    // Start pulsating animation for stop bars
    this.startAnimation();
  }

  /**
   * Animate pulsating stop bar lights by modulating opacity
   */
  private startAnimation(): void {
    if (this.animationFrame) return;
    const map = this.map;
    if (!map) return;

    const animate = () => {
      if (!map.getStyle() || !map.getLayer(this.layerId)) {
        this.animationFrame = null;
        return;
      }

      this.pulsatePhase = (this.pulsatePhase + 0.025) % 1;
      const pulse = 0.3 + 0.7 * Math.sin(this.pulsatePhase * Math.PI * 2);

      try {
        // Modulate opacity: pulsating lights fade in/out, static lights stay bright
        map.setPaintProperty(this.layerId, 'circle-opacity', [
          'case',
          ['get', 'isPulsating'],
          pulse,
          0.95,
        ]);
        map.setPaintProperty('airport-taxiway-lights-glow', 'circle-opacity', [
          'case',
          ['get', 'isPulsating'],
          pulse * 0.15,
          0.15,
        ]);
      } catch {
        // Layer may have been removed
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  protected performRemove(map: maplibregl.Map): void {
    this.stopAnimation();
    this.map = null;
    super.performRemove(map);
  }
}
