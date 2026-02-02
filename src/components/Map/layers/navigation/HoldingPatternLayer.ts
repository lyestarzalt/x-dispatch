import maplibregl from 'maplibre-gl';
import type { HoldingPattern } from '@/lib/navParser/types';

const SOURCE_ID = 'nav-holding-patterns-source';
const TRACK_LAYER_ID = 'nav-holding-patterns-track';
const LABEL_LAYER_ID = 'nav-holding-patterns-labels';

const HOLDING_COLOR = '#FF6B6B'; // Coral color for visibility

interface HoldingPatternWithCoords extends HoldingPattern {
  latitude: number;
  longitude: number;
}

/**
 * Create a race-track shaped holding pattern as GeoJSON LineString
 * @param hold The holding pattern data
 * @param fixLat Latitude of the fix
 * @param fixLon Longitude of the fix
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

function createHoldingGeoJSON(holds: HoldingPatternWithCoords[]): GeoJSON.FeatureCollection {
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

async function addHoldingPatternLayer(
  map: maplibregl.Map,
  holds: HoldingPatternWithCoords[]
): Promise<void> {
  removeHoldingPatternLayer(map);
  if (holds.length === 0) return;

  const geoJSON = createHoldingGeoJSON(holds);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  // Holding pattern track (race-track shape)
  map.addLayer({
    id: TRACK_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': HOLDING_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3],
      'line-opacity': 0.8,
      'line-dasharray': [4, 2],
    },
    minzoom: 8,
  });

  // Holding pattern labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
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
      'text-color': HOLDING_COLOR,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
    minzoom: 9,
  });
}

function removeHoldingPatternLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(TRACK_LAYER_ID)) map.removeLayer(TRACK_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

async function updateHoldingPatternLayer(
  map: maplibregl.Map,
  holds: HoldingPatternWithCoords[]
): Promise<void> {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createHoldingGeoJSON(holds));
  } else {
    await addHoldingPatternLayer(map, holds);
  }
}

function setHoldingPatternLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(TRACK_LAYER_ID)) map.setLayoutProperty(TRACK_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

const HOLDING_PATTERN_LAYER_IDS = [TRACK_LAYER_ID, LABEL_LAYER_ID];
