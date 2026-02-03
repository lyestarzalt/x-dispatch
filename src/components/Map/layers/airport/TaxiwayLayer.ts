import maplibregl from 'maplibre-gl';
import { getSurfaceColor, getSurfaceOutlineColor } from '@/config/mapStyles/surfaceColors';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createTaxiwayGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class TaxiwayLayer extends BaseLayerRenderer {
  layerId = 'airport-taxiways';
  sourceId = 'airport-taxiways';

  hasData(airport: ParsedAirport): boolean {
    return airport.taxiways && airport.taxiways.length > 0;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    const geoJSON = createTaxiwayGeoJSON(airport.taxiways);
    this.addSource(map, geoJSON);

    // Build color expression for surface types
    const colorExpression = this.buildSurfaceColorExpression();

    this.addLayer(map, {
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.taxiways.minZoom,
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 0.9,
        'fill-outline-color': this.buildSurfaceOutlineColorExpression(),
      },
    });
  }

  private buildSurfaceColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    // Add all known surface types
    const surfaceTypes = [
      1, 2, 3, 4, 5, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
      36, 37, 38, 50, 51, 52, 53, 54, 55, 56, 57,
    ];
    for (const type of surfaceTypes) {
      matchExpression.push(type, getSurfaceColor(type));
    }

    matchExpression.push('#555555'); // fallback (default taxiway color)
    return matchExpression as maplibregl.ExpressionSpecification;
  }

  private buildSurfaceOutlineColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    const surfaceTypes = [
      1, 2, 3, 4, 5, 12, 13, 14, 15, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
      36, 37, 38, 50, 51, 52, 53, 54, 55, 56, 57,
    ];
    for (const type of surfaceTypes) {
      matchExpression.push(type, getSurfaceOutlineColor(type));
    }

    matchExpression.push('#666666'); // fallback
    return matchExpression as maplibregl.ExpressionSpecification;
  }
}
