import maplibregl from 'maplibre-gl';
import { safeAddGeoJSONSource, safeRemove, setLayersVisibility } from '../types';

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
   * Add the layer to the map with the given data.
   *
   * Idempotent across concurrent calls: if a racer mounted the source while
   * we awaited loadImages(), we update its data via setData() and skip the
   * layer-add step (the racer already created the layers).
   */
  async add(map: maplibregl.Map, data: T[]): Promise<void> {
    this.remove(map);
    if (data.length === 0) return;

    await this.loadImages(map);

    const geoJSON = this.createGeoJSON(data);
    this.safeAddSource(map, this.sourceId, geoJSON);
    this.ensureLayers(map);
  }

  /**
   * Idempotent source helper for subclasses with multiple sources (ILS,
   * Airway). Wraps the shared `safeAddGeoJSONSource` utility.
   */
  protected safeAddSource(
    map: maplibregl.Map,
    sourceId: string,
    data: GeoJSON.FeatureCollection
  ): void {
    safeAddGeoJSONSource(map, sourceId, data);
  }

  /**
   * Add layers only if the primary layer isn't already mounted. Pair with
   * `safeAddSource` to make `add()` overrides race-safe — layers and sources
   * are added together, so a present `layerId` means the racer already
   * called `addLayers`.
   */
  protected ensureLayers(map: maplibregl.Map): void {
    if (map.getLayer(this.layerId)) return;
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
   * Remove the layer and source from the map.
   * Tries direct removal first — safeRemove defers when isStyleLoaded()
   * is false, which causes add() to fail because the old source still exists.
   */
  remove(map: maplibregl.Map): void {
    if (!map.getStyle()) return;
    try {
      this.performRemove(map);
    } catch {
      safeRemove(map, () => this.performRemove(map));
    }
  }

  /** Raw removal logic — override in subclasses for extra cleanup. */
  protected performRemove(map: maplibregl.Map): void {
    for (const id of this.additionalLayerIds) {
      try {
        if (map.getLayer(id)) map.removeLayer(id);
      } catch {
        /* ignore */
      }
    }
    try {
      if (map.getLayer(this.layerId)) map.removeLayer(this.layerId);
    } catch {
      /* ignore */
    }
    try {
      if (map.getSource(this.sourceId)) map.removeSource(this.sourceId);
    } catch {
      /* ignore */
    }
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
