import maplibregl from 'maplibre-gl';
import {
  NAV_COLORS,
  NAV_LABEL_STYLES,
  NAV_SYMBOL_SIZES,
  NAV_ZOOM_LEVELS,
} from '@/config/navLayerConfig';
import type { Waypoint } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

/**
 * Waypoint Layer - renders navigation waypoints/fixes
 */
export class WaypointLayerRenderer extends NavLayerRenderer<Waypoint> {
  readonly layerId = 'nav-waypoints';
  readonly sourceId = 'nav-waypoints-source';
  readonly additionalLayerIds = ['nav-waypoints-labels'];

  protected createGeoJSON(waypoints: Waypoint[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: waypoints.map((wp) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [wp.longitude, wp.latitude],
        },
        properties: {
          id: wp.id,
          region: wp.region,
        },
      })),
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    const labelsLayerId = this.additionalLayerIds[0];
    if (!labelsLayerId) return;

    const sizes = NAV_SYMBOL_SIZES.waypoint;

    // Waypoint symbol - small circle
    map.addLayer({
      id: this.layerId,
      type: 'circle',
      source: this.sourceId,
      minzoom: NAV_ZOOM_LEVELS.waypoints.symbols,
      paint: {
        'circle-color': NAV_COLORS.waypoint.standard,
        'circle-radius': [
          'interpolate',
          ['linear'],
          ['zoom'],
          8,
          sizes.min,
          12,
          sizes.medium,
          16,
          sizes.max,
        ],
        'circle-stroke-width': 0,
        'circle-opacity': 0.7,
      },
    });

    // Waypoint labels - only at high zoom
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: NAV_ZOOM_LEVELS.waypoints.labels,
      layout: {
        'text-field': ['get', 'id'],
        'text-font': NAV_LABEL_STYLES.fonts.semibold,
        'text-size': NAV_LABEL_STYLES.textSize.waypoint,
        'text-offset': NAV_LABEL_STYLES.offset.waypoint,
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': NAV_COLORS.waypoint.standard,
        'text-halo-color': '#000000',
        'text-halo-width': NAV_LABEL_STYLES.haloWidth.small,
      },
    });
  }
}

export const waypointLayer = new WaypointLayerRenderer();
export const WAYPOINT_LAYER_IDS = waypointLayer.getAllLayerIds();
