import maplibregl from 'maplibre-gl';
import {
  NAV_COLORS,
  NAV_LABEL_STYLES,
  NAV_LIMITS,
  NAV_LINE_STYLES,
  NAV_ZOOM_LEVELS,
} from '@/config/navLayerConfig';
import type { AirwaySegmentWithCoords } from '@/types/navigation';
import { removeLayersAndSource, setLayersVisibility } from '../types';
import { NavLayerRenderer } from './NavLayerRenderer';

function createAirwayGeoJSON(airways: AirwaySegmentWithCoords[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: airways.map((airway, index) => ({
      type: 'Feature' as const,
      id: index,
      geometry: {
        type: 'LineString' as const,
        coordinates: [
          [airway.fromLon, airway.fromLat],
          [airway.toLon, airway.toLat],
        ],
      },
      properties: {
        name: airway.name,
        fromFix: airway.fromFix,
        toFix: airway.toFix,
        baseFl: airway.baseFl,
        topFl: airway.topFl,
      },
    })),
  };
}

function createAirwayLabelGeoJSON(airways: AirwaySegmentWithCoords[]): GeoJSON.FeatureCollection {
  // Create label points at midpoints, deduplicated by airway name + general location
  const labelFeatures: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const seenKeys = new Set<string>();
  const gridFactor = NAV_LIMITS.airwayLabelGridFactor;

  for (const airway of airways) {
    const midLat = (airway.fromLat + airway.toLat) / 2;
    const midLon = (airway.fromLon + airway.toLon) / 2;

    // Deduplicate using configurable grid factor
    const gridKey = `${airway.name}:${Math.round(midLat * gridFactor)}:${Math.round(midLon * gridFactor)}`;
    if (seenKeys.has(gridKey)) continue;
    seenKeys.add(gridKey);

    // Calculate bearing for rotation (text along the line)
    const dLon = airway.toLon - airway.fromLon;
    const dLat = airway.toLat - airway.fromLat;
    let bearing = Math.atan2(dLon, dLat) * (180 / Math.PI);
    // Keep text readable (not upside down)
    if (bearing > 90) bearing -= 180;
    if (bearing < -90) bearing += 180;

    labelFeatures.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [midLon, midLat],
      },
      properties: {
        name: airway.name,
        flRange: `${airway.baseFl}-${airway.topFl}`,
        bearing,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features: labelFeatures,
  };
}

/**
 * High Airway Layer - renders high-altitude airways (jet routes)
 */
export class HighAirwayLayerRenderer extends NavLayerRenderer<AirwaySegmentWithCoords> {
  readonly layerId = 'nav-high-airways';
  readonly sourceId = 'nav-high-airways-source';
  readonly additionalLayerIds = ['nav-high-airways-labels'];

  private readonly labelSourceId = 'nav-high-airways-source-labels';

  protected createGeoJSON(airways: AirwaySegmentWithCoords[]): GeoJSON.FeatureCollection {
    return createAirwayGeoJSON(airways);
  }

  protected addLayers(map: maplibregl.Map): void {
    const labelsLayerId = this.additionalLayerIds[0];
    if (!labelsLayerId) return;

    const highStyle = NAV_LINE_STYLES.airways.high;

    // Add thin line layer - X-Plane style
    map.addLayer({
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: NAV_ZOOM_LEVELS.highAirways.lines,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': NAV_COLORS.airways.line,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          highStyle.width.base,
          6,
          highStyle.width.medium,
          8,
          highStyle.width.zoomed,
          12,
          highStyle.width.max,
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          4,
          highStyle.opacity.base,
          6,
          highStyle.opacity.medium,
          10,
          highStyle.opacity.zoomed,
        ],
      },
    });

    const textSize = NAV_LABEL_STYLES.textSize.airways;

    // Add label layer - small box style
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.labelSourceId,
      minzoom: NAV_ZOOM_LEVELS.highAirways.labels,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': NAV_LABEL_STYLES.fonts.bold,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          6,
          textSize.min,
          10,
          textSize.medium,
          14,
          textSize.max,
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-placement': 'point',
        'text-padding': 4,
        'text-rotate': ['get', 'bearing'],
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': NAV_COLORS.airways.labelText,
        'text-halo-color': NAV_COLORS.airways.highLabelBg,
        'text-halo-width': NAV_LABEL_STYLES.haloWidth.airways,
        'text-halo-blur': 0,
      },
    });
  }

  // Override add to handle label source
  async add(map: maplibregl.Map, data: AirwaySegmentWithCoords[]): Promise<void> {
    this.remove(map);
    if (data.length === 0) return;

    // Add line source
    map.addSource(this.sourceId, {
      type: 'geojson',
      data: this.createGeoJSON(data),
    });

    // Add label source
    map.addSource(this.labelSourceId, {
      type: 'geojson',
      data: createAirwayLabelGeoJSON(data),
    });

    this.addLayers(map);
  }

  // Override update to handle label source
  async update(map: maplibregl.Map, data: AirwaySegmentWithCoords[]): Promise<void> {
    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(this.createGeoJSON(data));
      const labelSource = map.getSource(this.labelSourceId) as maplibregl.GeoJSONSource;
      if (labelSource) labelSource.setData(createAirwayLabelGeoJSON(data));
    } else {
      await this.add(map, data);
    }
  }

  // Override remove to handle label source
  remove(map: maplibregl.Map): void {
    removeLayersAndSource(map, this.layerId, this.sourceId, this.additionalLayerIds);
    if (map.getSource(this.labelSourceId)) map.removeSource(this.labelSourceId);
  }

  setVisibility(map: maplibregl.Map, visible: boolean): void {
    setLayersVisibility(map, [this.layerId, ...this.additionalLayerIds], visible);
  }
}

/**
 * Low Airway Layer - renders low-altitude airways (victor routes)
 */
export class LowAirwayLayerRenderer extends NavLayerRenderer<AirwaySegmentWithCoords> {
  readonly layerId = 'nav-low-airways';
  readonly sourceId = 'nav-low-airways-source';
  readonly additionalLayerIds = ['nav-low-airways-labels'];

  private readonly labelSourceId = 'nav-low-airways-source-labels';

  protected createGeoJSON(airways: AirwaySegmentWithCoords[]): GeoJSON.FeatureCollection {
    return createAirwayGeoJSON(airways);
  }

  protected addLayers(map: maplibregl.Map): void {
    const labelsLayerId = this.additionalLayerIds[0];
    if (!labelsLayerId) return;

    const lowStyle = NAV_LINE_STYLES.airways.low;

    // Add thin line layer - X-Plane style (dashed for low airways)
    map.addLayer({
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      minzoom: NAV_ZOOM_LEVELS.lowAirways.lines,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
      paint: {
        'line-color': NAV_COLORS.airways.line,
        'line-width': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          lowStyle.width.base,
          7,
          lowStyle.width.medium,
          9,
          lowStyle.width.zoomed,
          12,
          lowStyle.width.max,
        ],
        'line-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          5,
          lowStyle.opacity.base,
          7,
          lowStyle.opacity.medium,
          10,
          lowStyle.opacity.zoomed,
        ],
        'line-dasharray': lowStyle.dasharray,
      },
    });

    const textSize = NAV_LABEL_STYLES.textSize.airways;

    // Add label layer
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.labelSourceId,
      minzoom: NAV_ZOOM_LEVELS.lowAirways.labels,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': NAV_LABEL_STYLES.fonts.bold,
        'text-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          7,
          textSize.min,
          10,
          textSize.medium - 1,
          14,
          textSize.max - 1,
        ],
        'text-allow-overlap': false,
        'text-ignore-placement': false,
        'symbol-placement': 'point',
        'text-padding': 4,
        'text-rotate': ['get', 'bearing'],
        'text-rotation-alignment': 'map',
      },
      paint: {
        'text-color': NAV_COLORS.airways.labelText,
        'text-halo-color': NAV_COLORS.airways.lowLabelBg,
        'text-halo-width': NAV_LABEL_STYLES.haloWidth.airways,
        'text-halo-blur': 0,
      },
    });
  }

  // Override add to handle label source
  async add(map: maplibregl.Map, data: AirwaySegmentWithCoords[]): Promise<void> {
    this.remove(map);
    if (data.length === 0) return;

    // Add line source
    map.addSource(this.sourceId, {
      type: 'geojson',
      data: this.createGeoJSON(data),
    });

    // Add label source
    map.addSource(this.labelSourceId, {
      type: 'geojson',
      data: createAirwayLabelGeoJSON(data),
    });

    this.addLayers(map);
  }

  // Override update to handle label source
  async update(map: maplibregl.Map, data: AirwaySegmentWithCoords[]): Promise<void> {
    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(this.createGeoJSON(data));
      const labelSource = map.getSource(this.labelSourceId) as maplibregl.GeoJSONSource;
      if (labelSource) labelSource.setData(createAirwayLabelGeoJSON(data));
    } else {
      await this.add(map, data);
    }
  }

  // Override remove to handle label source
  remove(map: maplibregl.Map): void {
    removeLayersAndSource(map, this.layerId, this.sourceId, this.additionalLayerIds);
    if (map.getSource(this.labelSourceId)) map.removeSource(this.labelSourceId);
  }

  setVisibility(map: maplibregl.Map, visible: boolean): void {
    setLayersVisibility(map, [this.layerId, ...this.additionalLayerIds], visible);
  }
}

export const highAirwayLayer = new HighAirwayLayerRenderer();
export const lowAirwayLayer = new LowAirwayLayerRenderer();
export const HIGH_AIRWAY_LAYER_IDS = highAirwayLayer.getAllLayerIds();
export const LOW_AIRWAY_LAYER_IDS = lowAirwayLayer.getAllLayerIds();
