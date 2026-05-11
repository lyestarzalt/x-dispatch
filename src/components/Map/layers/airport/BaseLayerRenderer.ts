import maplibregl from 'maplibre-gl';
import type { ParsedAirport } from '@/types/apt';
import { safeAddGeoJSONSource, safeRemove } from '../types';

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
   * Additional source IDs this renderer creates (beyond sourceId).
   * Used by clearAirport() to ensure all sources are cleaned up.
   * E.g. RunwayLayer creates a separate 'airport-runway-shoulders' source.
   */
  additionalSourceIds?: string[];

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
  additionalSourceIds?: string[];

  abstract render(map: maplibregl.Map, airport: ParsedAirport): void | Promise<void>;
  abstract hasData(airport: ParsedAirport): boolean;

  remove(map: maplibregl.Map): void {
    safeRemove(map, () => this.performRemove(map));
  }

  /** Raw removal logic — override in subclasses for extra cleanup. */
  protected performRemove(map: maplibregl.Map): void {
    if (this.additionalLayerIds) {
      for (const layerId of this.additionalLayerIds) {
        if (map.getLayer(layerId)) {
          map.removeLayer(layerId);
        }
      }
    }

    if (map.getLayer(this.layerId)) {
      map.removeLayer(this.layerId);
    }

    if (map.getSource(this.sourceId)) {
      map.removeSource(this.sourceId);
    }
  }

  /**
   * Idempotent GeoJSON source add — delegates to the shared helper so airport
   * and nav layers go through the same lifecycle code path.
   */
  protected addSource(map: maplibregl.Map, data: GeoJSON.FeatureCollection): void {
    safeAddGeoJSONSource(map, this.sourceId, data);
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
