import maplibregl from 'maplibre-gl';
import {
  buildBorderColorExpression,
  buildBorderWidthExpression,
  buildLineColorExpression,
  buildLineWidthExpression,
} from '@/config/mapStyles/lineStyles';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createLinearFeatureGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Linear Feature Layer - Renders painted taxiway lines
 *
 * This layer renders ONLY the painted markings (hold lines, centerlines, etc.)
 * Lighting is handled separately by TaxiwayLightsLayer
 */
export class LinearFeatureLayer extends BaseLayerRenderer {
  layerId = 'airport-linear-features';
  sourceId = 'airport-linear-features';
  additionalLayerIds = ['airport-linear-features-border'];

  hasData(airport: ParsedAirport): boolean {
    return airport.linearFeatures && airport.linearFeatures.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createLinearFeatureGeoJSON(airport.linearFeatures);
    this.addSource(map, geoJSON);

    // Border layer (rendered below main line for outline effect)
    // Only render lines with valid lineType >= 1 (excludes 0, null, undefined)
    this.addLayer(map, {
      id: 'airport-linear-features-border',
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.linearFeatures.minZoom,
      filter: ['>=', ['get', 'lineType'], 1],
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': buildBorderColorExpression(),
        'line-width': buildBorderWidthExpression(),
        'line-opacity': 0.9,
      },
    });

    // Main painted line layer
    // Only render lines with valid lineType >= 1 (excludes 0, null, undefined)
    this.addLayer(map, {
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.linearFeatures.minZoom,
      filter: ['>=', ['get', 'lineType'], 1],
      paint: {
        'line-color': buildLineColorExpression(),
        'line-width': buildLineWidthExpression(),
        'line-opacity': 1,
      },
    });
  }
}
