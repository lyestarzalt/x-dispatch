import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import type { HoldingPattern } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

export interface HoldingPatternWithCoords extends HoldingPattern {
  latitude: number;
  longitude: number;
}

/**
 * Create a race-track shaped holding pattern as GeoJSON LineString
 */
function createHoldingTrackCoordinates(hold: HoldingPatternWithCoords): [number, number][] {
  const {
    latitude: fixLat,
    longitude: fixLon,
    inboundCourse,
    turnDirection,
    legDistance,
    legTime,
  } = hold;

  // Calculate leg length in nautical miles
  // Use distance if provided, otherwise estimate from time (assuming 180 kts)
  const legNm = legDistance > 0 ? legDistance : legTime * 3; // 3nm per minute at 180 kts

  // Convert to approximate degrees (rough estimate: 1nm ~ 1/60 degree)
  const legDeg = legNm / 60;

  // Inbound course in radians (inbound TO the fix)
  const inboundRad = ((inboundCourse - 90) * Math.PI) / 180; // Adjust for coordinate system

  // Outbound is opposite direction
  const outboundRad = inboundRad + Math.PI;

  // Calculate turn radius (standard rate turn = 1nm radius at 180 kts)
  const turnRadius = 0.015; // Degrees, approximate

  // Direction multiplier for left/right turns
  const turnMult = turnDirection === 'R' ? 1 : -1;

  // Generate the race-track shape
  const points: [number, number][] = [];
  const numTurnPoints = 12; // Points per semicircle

  // Start at the fix (end of inbound leg)
  points.push([fixLon, fixLat]);

  // First turn (at the fix)
  const perpAngle = inboundRad + (Math.PI / 2) * turnMult;
  const turnCenterLon1 = fixLon + turnRadius * Math.cos(perpAngle);
  const turnCenterLat1 = fixLat + turnRadius * Math.sin(perpAngle);

  for (let i = 1; i <= numTurnPoints; i++) {
    const angle = inboundRad + Math.PI + (i / numTurnPoints) * Math.PI * turnMult;
    const lon = turnCenterLon1 + turnRadius * Math.cos(angle);
    const lat = turnCenterLat1 + turnRadius * Math.sin(angle);
    points.push([lon, lat]);
  }

  // Outbound leg end point
  const outboundStartLon = points[points.length - 1][0];
  const outboundStartLat = points[points.length - 1][1];
  const outboundEndLon = outboundStartLon + legDeg * Math.cos(outboundRad);
  const outboundEndLat = outboundStartLat + legDeg * Math.sin(outboundRad);
  points.push([outboundEndLon, outboundEndLat]);

  // Second turn (at outbound end)
  const turnCenterLon2 = outboundEndLon + turnRadius * Math.cos(perpAngle);
  const turnCenterLat2 = outboundEndLat + turnRadius * Math.sin(perpAngle);

  for (let i = 1; i <= numTurnPoints; i++) {
    const angle = outboundRad + Math.PI + (i / numTurnPoints) * Math.PI * turnMult;
    const lon = turnCenterLon2 + turnRadius * Math.cos(angle);
    const lat = turnCenterLat2 + turnRadius * Math.sin(angle);
    points.push([lon, lat]);
  }

  // Close back to fix
  points.push([fixLon, fixLat]);

  return points;
}

/**
 * Holding Pattern Layer - renders race-track holding patterns at fixes
 */
export class HoldingPatternLayerRenderer extends NavLayerRenderer<HoldingPatternWithCoords> {
  readonly layerId = 'nav-holding-patterns-track';
  readonly sourceId = 'nav-holding-patterns-source';
  readonly additionalLayerIds = ['nav-holding-patterns-labels'];

  protected createGeoJSON(holds: HoldingPatternWithCoords[]): GeoJSON.FeatureCollection {
    const features: GeoJSON.Feature[] = [];

    for (const hold of holds) {
      const trackCoords = createHoldingTrackCoordinates(hold);

      // Race-track line
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: trackCoords,
        },
        properties: {
          fixId: hold.fixId,
          inboundCourse: hold.inboundCourse,
          turnDirection: hold.turnDirection,
          minAlt: hold.minAlt,
          maxAlt: hold.maxAlt,
          speedKts: hold.speedKts,
        },
      });

      // Label point (at the fix)
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [hold.longitude, hold.latitude],
        },
        properties: {
          fixId: hold.fixId,
          label: `${hold.fixId}\n${hold.inboundCourse}° ${hold.turnDirection}T`,
          minAlt: hold.minAlt > 0 ? hold.minAlt : null,
          maxAlt: hold.maxAlt > 0 ? hold.maxAlt : null,
        },
      });
    }

    return {
      type: 'FeatureCollection',
      features,
    };
  }

  protected addLayers(map: maplibregl.Map): void {
    // Holding pattern track (race-track shape)
    map.addLayer({
      id: this.layerId,
      type: 'line',
      source: this.sourceId,
      filter: ['==', '$type', 'LineString'],
      paint: {
        'line-color': NAV_COLORS.holdingPattern,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3],
        'line-opacity': 0.8,
        'line-dasharray': [4, 2],
      },
      minzoom: 8,
    });

    // Holding pattern labels
    map.addLayer({
      id: this.additionalLayerIds[0],
      type: 'symbol',
      source: this.sourceId,
      filter: ['==', '$type', 'Point'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Open Sans Semibold'],
        'text-size': 10,
        'text-offset': [0, -2],
        'text-anchor': 'bottom',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': NAV_COLORS.holdingPattern,
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
      minzoom: 9,
    });
  }
}

export const holdingPatternLayer = new HoldingPatternLayerRenderer();
export const HOLDING_PATTERN_LAYER_IDS = holdingPatternLayer.getAllLayerIds();
