import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';
import {
  SIGN_LAYER_CONFIG,
  generateSignCacheKey,
  generateSignImage,
  parseSignText,
} from '@/lib/signRenderer';
import type { SignSegment } from '@/lib/signRenderer';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class SignLayer extends BaseLayerRenderer {
  layerId = 'airport-signs';
  sourceId = 'airport-signs';
  additionalLayerIds: string[] = [];

  hasData(airport: ParsedAirport): boolean {
    return airport.signs && airport.signs.length > 0;
  }

  async render(map: maplibregl.Map, airport: ParsedAirport): Promise<void> {
    if (!this.hasData(airport)) return;

    // Process signs and collect unique images to generate
    const imageMap = new Map<string, { segments: SignSegment[]; size: number }>();
    const features = airport.signs.map((sign) => {
      const parsed = parseSignText(sign.text);
      const imageId = generateSignCacheKey(parsed.front, sign.size);

      if (!imageMap.has(imageId) && parsed.front.length > 0) {
        imageMap.set(imageId, { segments: parsed.front, size: sign.size });
      }

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

    // Pre-generate all sign images before adding the layer
    await Promise.all(
      Array.from(imageMap.entries()).map(async ([imageId, { segments, size }]) => {
        if (map.hasImage(imageId)) return;
        try {
          const image = await generateSignImage(segments, size);
          if (!map.hasImage(imageId)) {
            map.addImage(imageId, image);
          }
        } catch (err) {
          console.error(`Failed to generate sign: ${imageId}`, err);
        }
      })
    );

    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    this.addSource(map, geoJSON);

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: SIGN_LAYER_CONFIG.minZoom,
      layout: {
        'icon-image': ['get', 'imageId'],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': SIGN_LAYER_CONFIG.iconSize,
      },
    });
  }
}
