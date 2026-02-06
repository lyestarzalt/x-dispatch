import maplibregl from 'maplibre-gl';
import { ParsedAirport } from '@/lib/aptParser';

/**
 * Interface for all layer renderers
 * Each layer type implements this interface for consistent rendering
 */
export interface LayerRenderer {
  /** Unique layer identifier */
  layerId: string;
  /** Source identifier for GeoJSON data */
  sourceId: string;
  /** Additional layer IDs this renderer creates */
  additionalLayerIds?: string[];

  /**
   * Render the layer on the map
   * @param map MapLibre map instance
   * @param airport Parsed airport data
   */
  render(map: maplibregl.Map, airport: ParsedAirport): void | Promise<void>;

  /**
   * Remove the layer and source from the map
   * @param map MapLibre map instance
   */
  remove(map: maplibregl.Map): void;

  /**
   * Check if this layer has data to render
   * @param airport Parsed airport data
   */
  hasData(airport: ParsedAirport): boolean;
}

/**
 * Base class for layer renderers with common functionality
 */
export abstract class BaseLayerRenderer implements LayerRenderer {
  abstract layerId: string;
  abstract sourceId: string;
  additionalLayerIds?: string[];

  abstract render(map: maplibregl.Map, airport: ParsedAirport): void | Promise<void>;
  abstract hasData(airport: ParsedAirport): boolean;

  remove(map: maplibregl.Map): void {
    // Remove additional layers first
    if (this.additionalLayerIds) {
      for (const layerId of this.additionalLayerIds) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
    }

    // Remove main layer
    if (map.getLayer(this.layerId)) {
      map.removeLayer(this.layerId);
    }

    // Remove source
    if (map.getSource(this.sourceId)) {
      map.removeSource(this.sourceId);
    }
  }

  /**
   * Helper to safely add a source if it doesn't exist
   */
  protected addSource(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
    if (!map.getSource(this.sourceId)) {
      map.addSource(this.sourceId, {
        type: 'geojson',
        data,
      });
    }
  }

  /**
   * Helper to safely add a layer
   */
  protected addLayer(
    map: maplibregl.Map,
    spec: maplibregl.LayerSpecification,
    beforeId?: string
  ): void {
    if (!map.getLayer(spec.id)) {
      map.addLayer(spec, beforeId);
    }
  }
}
