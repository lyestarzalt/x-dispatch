import maplibregl from 'maplibre-gl';
import { SURFACE_TYPES, getSurfaceColor } from '@/config/mapStyles/surfaceColors';
import { ZOOM_BEHAVIORS } from '@/config/mapStyles/zoomBehaviors';
import { ParsedAirport } from '@/lib/aptParser';
import { createRunwayGeoJSON, createRunwayShoulderGeoJSON } from '../../utils/geoJsonFactory';
import { BaseLayerRenderer } from './BaseLayerRenderer';

export class RunwayLayer extends BaseLayerRenderer {
  layerId = 'airport-runways';
  sourceId = 'airport-runways';
  additionalLayerIds = [
    'airport-runway-shoulders',
    'airport-runway-centerlines',
    'airport-runway-labels',
  ];
  private shoulderSourceId = 'airport-runway-shoulders';

  hasData(airport: ParsedAirport): boolean {
    return airport.runways && airport.runways.length > 0;
  }

  /**
   * Override remove to also clean up shoulder source
   */
  remove(map: maplibregl.Map): void {
    super.remove(map);

    if (map.getSource(this.shoulderSourceId)) {
      map.removeSource(this.shoulderSourceId);
    }
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    // Create and add shoulder source/layer first (renders below runway)
    const shoulderGeoJSON = createRunwayShoulderGeoJSON(airport.runways);
    if (shoulderGeoJSON.features.length > 0) {
      map.addSource(this.shoulderSourceId, {
        type: 'geojson',
        data: shoulderGeoJSON,
      });

      this.addLayer(map, {
        id: 'airport-runway-shoulders',
        type: 'fill',
        source: this.shoulderSourceId,
        minzoom: ZOOM_BEHAVIORS.runways.minZoom,
        paint: {
          'fill-color': this.buildSurfaceColorExpression(),
          'fill-opacity': 1,
        },
      });
    }

    const geoJSON = createRunwayGeoJSON(airport.runways);
    this.addSource(map, geoJSON);

    const colorExpression = this.buildSurfaceColorExpression();

    this.addLayer(map, {
      id: this.layerId,
      type: 'fill',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.runways.minZoom,
      paint: {
        'fill-color': colorExpression,
        'fill-opacity': 1,
      },
    });

    this.addLayer(map, {
      id: 'airport-runway-centerlines',
      type: 'line',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.runways.minZoom + 2,
      paint: {
        'line-color': '#FFFFFF',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3, 20, 5],
        'line-dasharray': [10, 10],
        'line-opacity': 0.9,
      },
    });

    this.addLayer(map, {
      id: 'airport-runway-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: ZOOM_BEHAVIORS.labels.minZoom,
      layout: {
        'text-field': ['get', 'name'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 14, 12, 18, 18],
        'text-font': ['Open Sans Bold'],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
      },
      paint: {
        'text-color': '#FFFFFF',
        'text-halo-color': '#000000',
        'text-halo-width': 2,
      },
    });
  }

  private buildSurfaceColorExpression(): maplibregl.ExpressionSpecification {
    const matchExpression: unknown[] = ['match', ['get', 'surface']];

    for (const type of SURFACE_TYPES) {
      matchExpression.push(type, getSurfaceColor(type));
    }

    matchExpression.push('#787878'); // fallback (default runway color - dark asphalt)
    return matchExpression as maplibregl.ExpressionSpecification;
  }
}
