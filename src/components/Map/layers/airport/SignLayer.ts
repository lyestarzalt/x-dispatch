import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import {
  SIGN_LAYER_CONFIG,
  decodeSignCacheKey,
  generateSignCacheKey,
  generateSignImage,
  parseSignText,
} from '@/lib/signRenderer';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Sign Layer - Renders airport taxiway signs as SVG images
 *
 * Signs are rendered as proper rectangular images with:
 * - @Y: Direction signs (black text on yellow background)
 * - @L: Location signs (yellow text on black background)
 * - @R: Mandatory/Hold signs (white text on red background)
 * - @B: Distance remaining signs (white text on black background)
 *
 * Multi-segment signs are rendered as connected rectangles.
 */
export class SignLayer extends BaseLayerRenderer {
  layerId = 'airport-signs';
  sourceId = 'airport-signs';
  additionalLayerIds: string[] = [];

  private imageLoadingSet = new Set<string>();
  private styleMissingHandler: ((e: { id: string }) => void) | null = null;

  hasData(airport: ParsedAirport): boolean {
    return airport.signs && airport.signs.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    // Register the styleimagemissing handler for lazy image generation
    this.registerImageHandler(map);

    // Process signs to generate image cache keys
    const features = airport.signs.map((sign) => {
      const parsed = parseSignText(sign.text);
      const imageId = generateSignCacheKey(parsed.front, sign.size);

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [sign.longitude, sign.latitude],
        },
        properties: {
          imageId,
          heading: sign.heading,
          size: sign.size,
        },
      };
    });

    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    this.addSource(map, geoJSON);

    // Single symbol layer using generated sign images
    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: SIGN_LAYER_CONFIG.minZoom,
      layout: {
        'icon-image': ['get', 'imageId'],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'viewport', // Keep icons facing viewer, no pitch distortion
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': SIGN_LAYER_CONFIG.iconSize,
      },
      paint: {
        'icon-opacity': 1,
      },
    });
  }

  /**
   * Register handler for styleimagemissing event to generate sign images on demand
   */
  private registerImageHandler(map: maplibregl.Map): void {
    // Remove existing handler if any
    if (this.styleMissingHandler) {
      map.off('styleimagemissing', this.styleMissingHandler);
    }

    this.styleMissingHandler = async (e: { id: string }) => {
      const imageId = e.id;

      // Only handle our sign images
      if (!imageId.startsWith('sign-')) return;

      // Prevent duplicate loading
      if (this.imageLoadingSet.has(imageId)) return;
      if (map.hasImage(imageId)) return;

      this.imageLoadingSet.add(imageId);

      try {
        const decoded = decodeSignCacheKey(imageId);
        if (!decoded) {
          console.warn(`Invalid sign image ID: ${imageId}`);
          return;
        }

        const image = await generateSignImage(decoded.segments, decoded.size);

        // Check again in case it was added while we were loading
        if (!map.hasImage(imageId)) {
          map.addImage(imageId, image);
        }
      } catch (err) {
        console.error(`Failed to generate sign image: ${imageId}`, err);
      } finally {
        this.imageLoadingSet.delete(imageId);
      }
    };

    map.on('styleimagemissing', this.styleMissingHandler);
  }

  override remove(map: maplibregl.Map): void {
    // Remove the styleimagemissing handler
    if (this.styleMissingHandler) {
      map.off('styleimagemissing', this.styleMissingHandler);
      this.styleMissingHandler = null;
    }

    this.imageLoadingSet.clear();
    super.remove(map);
  }
}
