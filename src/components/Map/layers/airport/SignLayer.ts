import maplibregl from 'maplibre-gl';
import {
  SIGN_TYPE_COLORS,
  buildSignFontSizeExpression,
  buildSignHaloWidthExpression,
  parseSignText,
} from '@/config/mapStyles/signStyles';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { BaseLayerRenderer } from '../BaseLayerRenderer';

/**
 * Sign Layer - Renders airport taxiway signs according to X-Plane spec
 *
 * Sign types:
 * - @Y: Direction signs (black text on yellow background)
 * - @L: Location signs (yellow text on black background)
 * - @R: Mandatory/Hold signs (white text on red background)
 * - @B: Distance remaining signs (white text on black background)
 */
export class SignLayer extends BaseLayerRenderer {
  layerId = 'airport-signs';
  sourceId = 'airport-signs';
  additionalLayerIds = ['airport-signs-direction'];

  hasData(airport: ParsedAirport): boolean {
    return airport.signs && airport.signs.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    // Process signs to extract type and clean text
    const processedSigns = airport.signs.map((sign) => {
      const parsed = parseSignText(sign.text);
      return {
        ...sign,
        text: parsed.text,
        signType: parsed.signType,
        hasArrow: parsed.hasArrow,
        arrowDirection: parsed.arrowDirection,
      };
    });

    // Create GeoJSON with processed data
    const geoJSON: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: processedSigns.map((sign) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [sign.longitude, sign.latitude],
        },
        properties: {
          text: sign.text,
          size: sign.size,
          heading: sign.heading,
          signType: sign.signType,
          hasArrow: sign.hasArrow,
          arrowDirection: sign.arrowDirection,
        },
      })),
    };

    this.addSource(map, geoJSON);

    // Build color expressions based on sign type
    const textColorExpr = this.buildTextColorExpression();
    const haloColorExpr = this.buildHaloColorExpression();

    // Main sign text layer
    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.signs.minZoom,
      layout: {
        'text-field': ['get', 'text'],
        'text-font': ['Open Sans Bold'],
        'text-size': buildSignFontSizeExpression(),
        'text-rotate': ['get', 'heading'],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'text-padding': 4,
        'text-anchor': 'center',
      },
      paint: {
        'text-color': textColorExpr,
        'text-halo-color': haloColorExpr,
        'text-halo-width': buildSignHaloWidthExpression(),
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 15, 0, 16, 1],
      },
    });

    // Direction indicator arrow below sign
    this.addLayer(map, {
      id: 'airport-signs-direction',
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.signs.minZoom + 1,
      layout: {
        'text-field': '\u25BC', // ▼ pointing down (will be rotated)
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 16, 6, 18, 10],
        'text-rotate': ['get', 'heading'],
        'text-offset': [0, 1.4],
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: {
        'text-color': [
          'match',
          ['get', 'signType'],
          'direction',
          '#FFD700', // Yellow for direction signs
          'location',
          '#FFD700', // Yellow for location signs
          'mandatory',
          '#CC0000', // Red for hold signs
          'distance',
          '#666666', // Gray for distance
          '#888888', // Default gray
        ],
        'text-opacity': ['interpolate', ['linear'], ['zoom'], 16, 0, 17, 0.6],
      },
    });
  }

  /**
   * Build MapLibre expression for text color based on sign type
   */
  private buildTextColorExpression(): maplibregl.ExpressionSpecification {
    return [
      'match',
      ['get', 'signType'],
      'direction',
      SIGN_TYPE_COLORS.direction.textColor,
      'location',
      SIGN_TYPE_COLORS.location.textColor,
      'mandatory',
      SIGN_TYPE_COLORS.mandatory.textColor,
      'distance',
      SIGN_TYPE_COLORS.distance.textColor,
      SIGN_TYPE_COLORS.unknown.textColor,
    ] as maplibregl.ExpressionSpecification;
  }

  /**
   * Build MapLibre expression for halo/background color based on sign type
   */
  private buildHaloColorExpression(): maplibregl.ExpressionSpecification {
    return [
      'match',
      ['get', 'signType'],
      'direction',
      SIGN_TYPE_COLORS.direction.haloColor,
      'location',
      SIGN_TYPE_COLORS.location.haloColor,
      'mandatory',
      SIGN_TYPE_COLORS.mandatory.haloColor,
      'distance',
      SIGN_TYPE_COLORS.distance.haloColor,
      SIGN_TYPE_COLORS.unknown.haloColor,
    ] as maplibregl.ExpressionSpecification;
  }

  override remove(map: maplibregl.Map): void {
    // Remove additional layers
    for (const layerId of this.additionalLayerIds) {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    }
    super.remove(map);
  }
}
