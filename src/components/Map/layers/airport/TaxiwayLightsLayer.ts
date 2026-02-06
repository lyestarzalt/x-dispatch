import { ScatterplotLayer } from '@deck.gl/layers';
import { MapboxOverlay } from '@deck.gl/mapbox';
import maplibregl from 'maplibre-gl';
import {
  AirportLight,
  LIGHT_COLORS,
  LightColor,
  generateAirportLights,
} from '@/lib/airportLighting';
import { ParsedAirport } from '@/lib/aptParser';
import { BaseLayerRenderer } from './BaseLayerRenderer';

// Type for deck.gl color arrays
type RGBAColor = [number, number, number, number];

/**
 * Convert hex color to RGBA array for deck.gl
 */
function hexToRgba(hex: string, alpha = 255): RGBAColor {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [255, 255, 255, alpha];
  return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16), alpha];
}

/**
 * Get color for a light
 */
function getLightColor(color: LightColor): RGBAColor {
  return hexToRgba(LIGHT_COLORS[color].hex, 255);
}

/**
 * Get glow color for a light (more transparent)
 */
function getGlowColor(color: LightColor): RGBAColor {
  return hexToRgba(LIGHT_COLORS[color].hex, 80);
}

/**
 * Taxiway Lights Layer - Uses deck.gl for realistic light rendering
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
  additionalLayerIds: string[] = [];

  private overlay: MapboxOverlay | null = null;
  private lights: AirportLight[] = [];
  private animationFrame: number | null = null;
  private pulsatePhase = 0;
  private map: maplibregl.Map | null = null;

  hasData(airport: ParsedAirport): boolean {
    return airport.linearFeatures && airport.linearFeatures.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    this.map = map;

    // Generate lights using proper FAA spacing
    this.lights = generateAirportLights(airport.linearFeatures);

    if (this.lights.length === 0) return;

    // Create deck.gl overlay
    this.overlay = new MapboxOverlay({
      interleaved: true,
      layers: this.createLayers(),
    });

    // MapboxOverlay works with MapLibre (compatible API)
    (map as unknown as { addControl: (ctrl: unknown) => void }).addControl(this.overlay);

    // Start pulsating animation
    this.startAnimation();
  }

  /**
   * Create deck.gl layers for the lights
   */
  private createLayers() {
    // Separate static and pulsating lights
    const staticLights = this.lights.filter((l) => !l.isPulsating);
    const pulsatingLights = this.lights.filter((l) => l.isPulsating);

    // Calculate pulsating opacity using sine wave
    const pulseOpacity = 0.3 + 0.7 * Math.sin(this.pulsatePhase * Math.PI * 2);

    return [
      // Outer glow layer for static lights - soft halo effect
      new ScatterplotLayer<AirportLight>({
        id: 'taxiway-lights-glow',
        data: staticLights,
        pickable: false,
        opacity: 0.2,
        stroked: false,
        filled: true,
        radiusMinPixels: 3,
        radiusMaxPixels: 8,
        radiusScale: 1,
        getPosition: (d) => [...d.coordinates, 0] as [number, number, number],
        getRadius: (d) => 3 * d.intensity,
        getFillColor: (d) => getGlowColor(d.color),
      }),

      // Main layer for static lights - visible colored circle
      new ScatterplotLayer<AirportLight>({
        id: 'taxiway-lights-main',
        data: staticLights,
        pickable: false,
        opacity: 0.95,
        stroked: false,
        filled: true,
        radiusMinPixels: 1.5,
        radiusMaxPixels: 4,
        radiusScale: 1,
        getPosition: (d) => [...d.coordinates, 0] as [number, number, number],
        getRadius: (d) => 1.5 * d.intensity,
        getFillColor: (d) => getLightColor(d.color),
      }),

      // Bright white core for static lights
      new ScatterplotLayer<AirportLight>({
        id: 'taxiway-lights-core',
        data: staticLights,
        pickable: false,
        opacity: 1,
        stroked: false,
        filled: true,
        radiusMinPixels: 0.5,
        radiusMaxPixels: 2,
        radiusScale: 1,
        getPosition: (d) => [...d.coordinates, 0] as [number, number, number],
        getRadius: (d) => 0.6 * d.intensity,
        getFillColor: () => [255, 255, 255, 255] as RGBAColor,
      }),

      // Pulsating lights glow - animated halo
      new ScatterplotLayer<AirportLight>({
        id: 'taxiway-lights-pulsating-glow',
        data: pulsatingLights,
        pickable: false,
        opacity: pulseOpacity * 0.3,
        stroked: false,
        filled: true,
        radiusMinPixels: 4,
        radiusMaxPixels: 10,
        radiusScale: 1,
        getPosition: (d) => [...d.coordinates, 0] as [number, number, number],
        getRadius: (d) => 4 * d.intensity,
        getFillColor: (d) => getGlowColor(d.color),
      }),

      // Pulsating lights main - visible pulsing circle
      new ScatterplotLayer<AirportLight>({
        id: 'taxiway-lights-pulsating-main',
        data: pulsatingLights,
        pickable: false,
        opacity: pulseOpacity,
        stroked: false,
        filled: true,
        radiusMinPixels: 2,
        radiusMaxPixels: 5,
        radiusScale: 1,
        getPosition: (d) => [...d.coordinates, 0] as [number, number, number],
        getRadius: (d) => 2 * d.intensity,
        getFillColor: (d) => getLightColor(d.color),
      }),

      // Pulsating lights core - bright center
      new ScatterplotLayer<AirportLight>({
        id: 'taxiway-lights-pulsating-core',
        data: pulsatingLights,
        pickable: false,
        opacity: pulseOpacity,
        stroked: false,
        filled: true,
        radiusMinPixels: 0.8,
        radiusMaxPixels: 2.5,
        radiusScale: 1,
        getPosition: (d) => [...d.coordinates, 0] as [number, number, number],
        getRadius: (d) => 0.8 * d.intensity,
        getFillColor: () => [255, 255, 255, 255] as RGBAColor,
      }),
    ];
  }

  /**
   * Start the pulsating animation
   */
  private startAnimation(): void {
    if (this.animationFrame) return;

    const animate = () => {
      // Pulsate at ~1.5 Hz (FAA standard is 30-60 cycles/minute)
      this.pulsatePhase = (this.pulsatePhase + 0.025) % 1;

      if (this.overlay) {
        this.overlay.setProps({ layers: this.createLayers() });
      }

      this.animationFrame = requestAnimationFrame(animate);
    };

    this.animationFrame = requestAnimationFrame(animate);
  }

  /**
   * Stop the animation
   */
  private stopAnimation(): void {
    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
  }

  remove(map: maplibregl.Map): void {
    // Stop animation
    this.stopAnimation();

    // Remove deck.gl overlay
    if (this.overlay && this.map) {
      try {
        (this.map as unknown as { removeControl: (ctrl: unknown) => void }).removeControl(
          this.overlay
        );
      } catch {
        // Overlay may have already been removed
      }
    }

    this.overlay = null;
    this.lights = [];

    // Parent class cleanup (if any MapLibre layers were added)
    super.remove(map);
  }
}
