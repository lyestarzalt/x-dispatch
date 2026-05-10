import maplibregl from 'maplibre-gl';
import {
  buildBorderColorExpression,
  buildBorderWidthExpression,
  buildLineColorExpression,
  buildLineWidthExpression,
} from '@/config/mapStyles/lineStyles';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import type { ParsedAirport } from '@/types/apt';
import { createLinearFeatureGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

/**
 * Linear Feature Layer — painted taxiway lines.
 *
 * Split into two pairs of layers (centerlines first, markings second) so the
 * dynamic taxi-route layer can slot between them. Render order:
 *
 *   airport-linear-features-centerline-border   (centerline casing)
 *   airport-linear-features-centerline          (centerline main)
 *   ── taxi-route layers anchor before the next layer ──
 *   airport-linear-features-border              (marking casing)
 *   airport-linear-features                     (marking main)
 *
 * apt.dat `lineType` codes treated as centerlines:
 *   1, 2   = solid / broken yellow taxiway centerlines
 *   51, 52 = same with a black border (runway taxiways)
 * Anything else with lineType ≥ 1 is a marking (hold-short bars, edge
 * markings, ILS critical-area lines, etc.).
 *
 * Lighting is handled separately by TaxiwayLightsLayer.
 */
const CENTERLINE_LINE_TYPES = [1, 2, 51, 52] as const;

export class LinearFeatureLayer extends BaseLayerRenderer {
  layerId = 'airport-linear-features';
  sourceId = 'airport-linear-features';
  additionalLayerIds = [
    'airport-linear-features-centerline-border',
    'airport-linear-features-centerline',
    'airport-linear-features-border',
  ];

  hasData(airport: ParsedAirport): boolean {
    return airport.linearFeatures && airport.linearFeatures.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createLinearFeatureGeoJSON(airport.linearFeatures);
    this.addSource(map, geoJSON);

    const isCenterline: maplibregl.FilterSpecification = [
      'match',
      ['get', 'lineType'],
      [...CENTERLINE_LINE_TYPES],
      true,
      false,
    ];
    const isMarking: maplibregl.FilterSpecification = [
      'all',
      ['>=', ['get', 'lineType'], 1],
      ['match', ['get', 'lineType'], [...CENTERLINE_LINE_TYPES], false, true],
    ];

    // ── Centerlines (lower stack) ─────────────────────────────────────
    this.addLayer(map, {
      id: 'airport-linear-features-centerline-border',
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.linearFeatures.minZoom,
      filter: isCenterline,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': buildBorderColorExpression(),
        'line-width': buildBorderWidthExpression(),
        'line-opacity': 0.9,
      },
    });

    this.addLayer(map, {
      id: 'airport-linear-features-centerline',
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.linearFeatures.minZoom,
      filter: isCenterline,
      paint: {
        'line-color': buildLineColorExpression(),
        'line-width': buildLineWidthExpression(),
        'line-opacity': 1,
      },
    });

    // ── Markings (upper stack — taxi-route anchors below this) ───────
    this.addLayer(map, {
      id: 'airport-linear-features-border',
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.linearFeatures.minZoom,
      filter: isMarking,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': buildBorderColorExpression(),
        'line-width': buildBorderWidthExpression(),
        'line-opacity': 0.9,
      },
    });

    this.addLayer(map, {
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.linearFeatures.minZoom,
      filter: isMarking,
      paint: {
        'line-color': buildLineColorExpression(),
        'line-width': buildLineWidthExpression(),
        'line-opacity': 1,
      },
    });
  }
}
