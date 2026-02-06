import maplibregl from 'maplibre-gl';
import type { ParsedAirport } from '@/lib/aptParser';
import { parseSignText } from '@/lib/signRenderer';
import { BaseLayerRenderer } from './BaseLayerRenderer';

const SIGN_COLORS = {
  Y: { text: '#000000', bg: '#FFCC00' }, // Direction
  L: { text: '#FFCC00', bg: '#000000' }, // Location
  R: { text: '#FFFFFF', bg: '#CC0000' }, // Mandatory
  B: { text: '#FFFFFF', bg: '#000000' }, // Distance
} as const;

const MIN_ZOOM = 16;

export class SignLayer extends BaseLayerRenderer {
  layerId = 'airport-signs';
  sourceId = 'airport-signs';
  additionalLayerIds: string[] = [];

  hasData(airport: ParsedAirport): boolean {
    return airport.signs && airport.signs.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const features = airport.signs.map((sign) => {
      const parsed = parseSignText(sign.text);
      const firstSegment = parsed.front[0];
      const signType = firstSegment?.type || 'L';
      const displayText = parsed.front.map((s) => s.text).join(' ');

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [sign.longitude, sign.latitude],
        },
        properties: {
          text: displayText,
          type: signType,
          heading: sign.heading,
        },
      };
    });

    this.addSource(map, { type: 'FeatureCollection', features });

    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: MIN_ZOOM,
      layout: {
        'text-field': ['get', 'text'],
        'text-size': 11,
        'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-rotate': ['get', 'heading'],
        'text-rotation-alignment': 'map',
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'type'],
          'Y',
          SIGN_COLORS.Y.text,
          'R',
          SIGN_COLORS.R.text,
          'B',
          SIGN_COLORS.B.text,
          SIGN_COLORS.L.text,
        ],
        'text-halo-color': [
          'match',
          ['get', 'type'],
          'Y',
          SIGN_COLORS.Y.bg,
          'R',
          SIGN_COLORS.R.bg,
          'B',
          SIGN_COLORS.B.bg,
          SIGN_COLORS.L.bg,
        ],
        'text-halo-width': 3,
      },
    });
  }
}
