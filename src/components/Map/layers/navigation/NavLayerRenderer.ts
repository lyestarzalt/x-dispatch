import maplibregl from 'maplibre-gl';
import { removeLayersAndSource, setLayersVisibility } from '../types';

/**
 * Base class for navigation layer renderers (VOR, NDB, DME, ILS, Waypoint, etc.)
 *
 * Navigation layers differ from airport layers:
 * - They render from arrays of data (Navaid[], Waypoint[])
 * - They support async initialization (image loading)
 * - They support incremental updates via source.setData()
 */
export abstract class NavLayerRenderer<T> {
  abstract readonly layerId: string;
  abstract readonly sourceId: string;
  abstract readonly additionalLayerIds: string[];

  /**
   * Create GeoJSON from the data array
   */
  protected abstract createGeoJSON(data: T[]): GeoJSON.FeatureCollection;

  /**
   * Add layers to the map (called after source is added)
   */
  protected abstract addLayers(map: maplibregl.Map): void;

  /**
   * Optional: Load any required images before rendering
   * Override this if your layer uses custom symbols
   */
  protected async loadImages(_map: maplibregl.Map): Promise<boolean> {
    return true;
  }

  /**
   * Add the layer to the map with the given data
   */
  async add(map: maplibregl.Map, data: T[]): Promise<void> {
    this.remove(map);
    if (data.length === 0) return;

    // Load images if needed
    await this.loadImages(map);

    // Add source
    const geoJSON = this.createGeoJSON(data);
    map.addSource(this.sourceId, {
      type: 'geojson',
      data: geoJSON,
    });

    // Add layers
    this.addLayers(map);
  }

  /**
   * Update the layer data without removing/re-adding
   */
  async update(map: maplibregl.Map, data: T[]): Promise<void> {
    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(this.createGeoJSON(data));
    } else {
      await this.add(map, data);
    }
  }

  /**
   * Remove the layer and source from the map
   */
  remove(map: maplibregl.Map): void {
    removeLayersAndSource(map, this.layerId, this.sourceId, this.additionalLayerIds);
  }

  /**
   * Set visibility of all layers
   */
  setVisibility(map: maplibregl.Map, visible: boolean): void {
    setLayersVisibility(map, [this.layerId, ...this.additionalLayerIds], visible);
  }

  /**
   * Get all layer IDs for this renderer
   */
  getAllLayerIds(): string[] {
    return [this.layerId, ...this.additionalLayerIds];
  }
}
