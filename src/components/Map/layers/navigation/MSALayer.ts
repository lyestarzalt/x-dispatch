import maplibregl from 'maplibre-gl';
import type { MSASector } from '@/lib/navParser/types';

const SOURCE_ID = 'nav-msa-source';
const SECTOR_LAYER_ID = 'nav-msa-sectors';
const OUTLINE_LAYER_ID = 'nav-msa-outlines';
const LABEL_LAYER_ID = 'nav-msa-labels';

const MSA_COLOR = '#9370DB'; // Medium purple for MSA display

interface MSASectorWithCoords extends MSASector {
  latitude: number;
  longitude: number;
}

/**
 * Create an arc/sector polygon for MSA visualization
 */
function createSectorPolygon(
  centerLon: number,
  centerLat: number,
  radiusNm: number,
  startBearing: number,
  endBearing: number
): [number, number][] {
  const points: [number, number][] = [];
  const numPoints = 24; // Points along the arc

  // Convert radius from nm to approximate degrees
  const radiusDeg = radiusNm / 60;

  // Start at center
  points.push([centerLon, centerLat]);

  // Normalize bearings
  const start = startBearing % 360;
  let end = endBearing % 360;

  // Handle wrap-around (e.g., 350 to 010)
  if (end <= start) end += 360;

  // Create arc points
  const arcSpan = end - start;
  for (let i = 0; i <= numPoints; i++) {
    const bearing = start + (i / numPoints) * arcSpan;
    const bearingRad = (bearing * Math.PI) / 180;

    // Approximate lat/lon offset (good enough for display purposes)
    const lon = centerLon + radiusDeg * Math.sin(bearingRad);
    const lat = centerLat + radiusDeg * Math.cos(bearingRad);
    points.push([lon, lat]);
  }

  // Close back to center
  points.push([centerLon, centerLat]);

  return points;
}

/**
 * Calculate label position (midpoint of arc)
 */
function getLabelPosition(
  centerLon: number,
  centerLat: number,
  radiusNm: number,
  startBearing: number,
  endBearing: number
): [number, number] {
  const radiusDeg = radiusNm / 60;

  // Normalize bearings
  const start = startBearing % 360;
  let end = endBearing % 360;
  if (end <= start) end += 360;

  // Midpoint bearing
  const midBearing = (start + end) / 2;
  const bearingRad = (midBearing * Math.PI) / 180;

  // Position label at 60% of radius
  const labelRadius = radiusDeg * 0.6;
  const lon = centerLon + labelRadius * Math.sin(bearingRad);
  const lat = centerLat + labelRadius * Math.cos(bearingRad);

  return [lon, lat];
}

function formatAltitude(altitude: number): string {
  // Display as hundreds (like IFR charts)
  const hundreds = Math.round(altitude / 100);
  return hundreds.toString();
}

function createMSAGeoJSON(sectors: MSASectorWithCoords[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  // Group sectors by fix
  const sectorsByFix = new Map<string, MSASectorWithCoords[]>();
  for (const sector of sectors) {
    const key = `${sector.fixId}-${sector.fixRegion}`;
    if (!sectorsByFix.has(key)) {
      sectorsByFix.set(key, []);
    }
    sectorsByFix.get(key)!.push(sector);
  }

  for (const [, fixSectors] of sectorsByFix) {
    if (fixSectors.length === 0) continue;

    const first = fixSectors[0];
    const centerLon = first.longitude;
    const centerLat = first.latitude;

    // Create sector polygons
    for (const sector of fixSectors) {
      const sectorCoords = createSectorPolygon(
        centerLon,
        centerLat,
        sector.radius,
        sector.sectorBearing1,
        sector.sectorBearing2
      );

      // Sector polygon
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [sectorCoords],
        },
        properties: {
          fixId: sector.fixId,
          altitude: sector.altitude,
          bearing1: sector.sectorBearing1,
          bearing2: sector.sectorBearing2,
        },
      });

      // Sector altitude label
      const labelPos = getLabelPosition(
        centerLon,
        centerLat,
        sector.radius,
        sector.sectorBearing1,
        sector.sectorBearing2
      );

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: labelPos,
        },
        properties: {
          fixId: sector.fixId,
          altitude: sector.altitude,
          altDisplay: formatAltitude(sector.altitude),
        },
      });
    }

    // Add fix label at center
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [centerLon, centerLat],
      },
      properties: {
        fixId: first.fixId,
        isCenter: true,
        label: `MSA ${first.fixId}`,
      },
    });
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

async function addMSALayer(map: maplibregl.Map, sectors: MSASectorWithCoords[]): Promise<void> {
  removeMSALayer(map);
  if (sectors.length === 0) return;

  const geoJSON = createMSAGeoJSON(sectors);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  // MSA sector fills (very subtle)
  map.addLayer({
    id: SECTOR_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    filter: ['all', ['==', '$type', 'Polygon']],
    paint: {
      'fill-color': MSA_COLOR,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.05, 12, 0.1, 14, 0.15],
    },
    minzoom: 8,
  });

  // MSA sector outlines
  map.addLayer({
    id: OUTLINE_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'line-color': MSA_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 1.5, 14, 2],
      'line-opacity': 0.8,
    },
    minzoom: 8,
  });

  // MSA altitude labels (in sectors)
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['all', ['==', '$type', 'Point'], ['!', ['has', 'isCenter']]],
    layout: {
      'text-field': ['get', 'altDisplay'],
      'text-font': ['Open Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 12, 14, 14],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': MSA_COLOR,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
    minzoom: 9,
  });
}

function removeMSALayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(OUTLINE_LAYER_ID)) map.removeLayer(OUTLINE_LAYER_ID);
  if (map.getLayer(SECTOR_LAYER_ID)) map.removeLayer(SECTOR_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

async function updateMSALayer(map: maplibregl.Map, sectors: MSASectorWithCoords[]): Promise<void> {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createMSAGeoJSON(sectors));
  } else {
    await addMSALayer(map, sectors);
  }
}

function setMSALayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(SECTOR_LAYER_ID))
    map.setLayoutProperty(SECTOR_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(OUTLINE_LAYER_ID))
    map.setLayoutProperty(OUTLINE_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

const MSA_LAYER_IDS = [SECTOR_LAYER_ID, OUTLINE_LAYER_ID, LABEL_LAYER_ID];
