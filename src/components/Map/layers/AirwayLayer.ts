import maplibregl from 'maplibre-gl';
import {
  NAV_COLORS,
  NAV_LABEL_STYLES,
  NAV_LIMITS,
  NAV_LINE_STYLES,
  NAV_ZOOM_LEVELS,
} from '@/config/navLayerConfig';
import type { AirwaySegmentWithCoords } from '@/types/navigation';

// Source and layer IDs
const HIGH_AIRWAY_SOURCE_ID = 'nav-high-airways-source';
const HIGH_AIRWAY_LAYER_ID = 'nav-high-airways';
const HIGH_AIRWAY_LABEL_LAYER_ID = 'nav-high-airways-labels';

const LOW_AIRWAY_SOURCE_ID = 'nav-low-airways-source';
const LOW_AIRWAY_LAYER_ID = 'nav-low-airways';
const LOW_AIRWAY_LABEL_LAYER_ID = 'nav-low-airways-labels';

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

export function addHighAirwayLayer(map: maplibregl.Map, airways: AirwaySegmentWithCoords[]): void {
  removeHighAirwayLayer(map);
  if (airways.length === 0) return;

  const geoJSON = createAirwayGeoJSON(airways);
  const labelGeoJSON = createAirwayLabelGeoJSON(airways);

  // Add line source
  map.addSource(HIGH_AIRWAY_SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  const highStyle = NAV_LINE_STYLES.airways.high;

  // Add thin line layer - X-Plane style
  map.addLayer({
    id: HIGH_AIRWAY_LAYER_ID,
    type: 'line',
    source: HIGH_AIRWAY_SOURCE_ID,
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

  // Add label source
  map.addSource(`${HIGH_AIRWAY_SOURCE_ID}-labels`, {
    type: 'geojson',
    data: labelGeoJSON,
  });

  const textSize = NAV_LABEL_STYLES.textSize.airways;

  // Add label layer - small box style
  map.addLayer({
    id: HIGH_AIRWAY_LABEL_LAYER_ID,
    type: 'symbol',
    source: `${HIGH_AIRWAY_SOURCE_ID}-labels`,
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

export function removeHighAirwayLayer(map: maplibregl.Map): void {
  if (map.getLayer(HIGH_AIRWAY_LABEL_LAYER_ID)) map.removeLayer(HIGH_AIRWAY_LABEL_LAYER_ID);
  if (map.getLayer(HIGH_AIRWAY_LAYER_ID)) map.removeLayer(HIGH_AIRWAY_LAYER_ID);
  if (map.getSource(`${HIGH_AIRWAY_SOURCE_ID}-labels`))
    map.removeSource(`${HIGH_AIRWAY_SOURCE_ID}-labels`);
  if (map.getSource(HIGH_AIRWAY_SOURCE_ID)) map.removeSource(HIGH_AIRWAY_SOURCE_ID);
}

export function setHighAirwayLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(HIGH_AIRWAY_LAYER_ID))
    map.setLayoutProperty(HIGH_AIRWAY_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(HIGH_AIRWAY_LABEL_LAYER_ID))
    map.setLayoutProperty(HIGH_AIRWAY_LABEL_LAYER_ID, 'visibility', visibility);
}

export function addLowAirwayLayer(map: maplibregl.Map, airways: AirwaySegmentWithCoords[]): void {
  removeLowAirwayLayer(map);
  if (airways.length === 0) return;

  const geoJSON = createAirwayGeoJSON(airways);
  const labelGeoJSON = createAirwayLabelGeoJSON(airways);

  // Add line source
  map.addSource(LOW_AIRWAY_SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  const lowStyle = NAV_LINE_STYLES.airways.low;

  // Add thin line layer - X-Plane style (dashed for low airways)
  map.addLayer({
    id: LOW_AIRWAY_LAYER_ID,
    type: 'line',
    source: LOW_AIRWAY_SOURCE_ID,
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

  // Add label source
  map.addSource(`${LOW_AIRWAY_SOURCE_ID}-labels`, {
    type: 'geojson',
    data: labelGeoJSON,
  });

  const textSize = NAV_LABEL_STYLES.textSize.airways;

  // Add label layer
  map.addLayer({
    id: LOW_AIRWAY_LABEL_LAYER_ID,
    type: 'symbol',
    source: `${LOW_AIRWAY_SOURCE_ID}-labels`,
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

export function removeLowAirwayLayer(map: maplibregl.Map): void {
  if (map.getLayer(LOW_AIRWAY_LABEL_LAYER_ID)) map.removeLayer(LOW_AIRWAY_LABEL_LAYER_ID);
  if (map.getLayer(LOW_AIRWAY_LAYER_ID)) map.removeLayer(LOW_AIRWAY_LAYER_ID);
  if (map.getSource(`${LOW_AIRWAY_SOURCE_ID}-labels`))
    map.removeSource(`${LOW_AIRWAY_SOURCE_ID}-labels`);
  if (map.getSource(LOW_AIRWAY_SOURCE_ID)) map.removeSource(LOW_AIRWAY_SOURCE_ID);
}

export function setLowAirwayLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LOW_AIRWAY_LAYER_ID))
    map.setLayoutProperty(LOW_AIRWAY_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LOW_AIRWAY_LABEL_LAYER_ID))
    map.setLayoutProperty(LOW_AIRWAY_LABEL_LAYER_ID, 'visibility', visibility);
}

export const HIGH_AIRWAY_LAYER_IDS = [HIGH_AIRWAY_LAYER_ID, HIGH_AIRWAY_LABEL_LAYER_ID];
export const LOW_AIRWAY_LAYER_IDS = [LOW_AIRWAY_LAYER_ID, LOW_AIRWAY_LABEL_LAYER_ID];
