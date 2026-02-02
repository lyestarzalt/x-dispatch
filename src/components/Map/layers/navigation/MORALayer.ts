import maplibregl from 'maplibre-gl';
import type { MORACell } from '@/lib/navParser/types';

const SOURCE_ID = 'nav-mora-source';
const FILL_LAYER_ID = 'nav-mora-fill';
const LABEL_LAYER_ID = 'nav-mora-labels';
const GRID_LAYER_ID = 'nav-mora-grid';

// MORA colors based on altitude ranges
const MORA_COLORS = {
  low: '#3CB371', // <5000ft - Medium sea green
  medium: '#FFD700', // 5000-10000ft - Gold
  high: '#FF8C00', // 10000-15000ft - Dark orange
  veryHigh: '#FF4500', // >15000ft - Orange red
};

function getAltitudeColor(altitude: number): string {
  if (altitude < 5000) return MORA_COLORS.low;
  if (altitude < 10000) return MORA_COLORS.medium;
  if (altitude < 15000) return MORA_COLORS.high;
  return MORA_COLORS.veryHigh;
}

function formatAltitude(altitude: number): string {
  // Display in hundreds of feet (like IFR charts)
  const hundreds = Math.round(altitude / 100);
  if (hundreds >= 100) {
    // FL format for high altitudes
    return hundreds.toString();
  }
  return hundreds.toString();
}

function createMORAGeoJSON(cells: MORACell[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const cell of cells) {
    // Skip cells with no altitude data
    if (cell.altitude <= 0) continue;

    // Create polygon for the grid cell
    const polygon: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [cell.lonMin, cell.latMin],
            [cell.lonMax, cell.latMin],
            [cell.lonMax, cell.latMax],
            [cell.lonMin, cell.latMax],
            [cell.lonMin, cell.latMin], // Close the ring
          ],
        ],
      },
      properties: {
        altitude: cell.altitude,
        altDisplay: formatAltitude(cell.altitude),
        color: getAltitudeColor(cell.altitude),
      },
    };
    features.push(polygon);

    // Create center point for label
    const centerLon = (cell.lonMin + cell.lonMax) / 2;
    const centerLat = (cell.latMin + cell.latMax) / 2;

    const label: GeoJSON.Feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [centerLon, centerLat],
      },
      properties: {
        altitude: cell.altitude,
        altDisplay: formatAltitude(cell.altitude),
      },
    };
    features.push(label);
  }

  return {
    type: 'FeatureCollection',
    features,
  };
}

async function addMORALayer(map: maplibregl.Map, cells: MORACell[]): Promise<void> {
  removeMORALayer(map);
  if (cells.length === 0) return;

  const geoJSON = createMORAGeoJSON(cells);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  // MORA grid fill (very subtle background)
  map.addLayer({
    id: FILL_LAYER_ID,
    type: 'fill',
    source: SOURCE_ID,
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.05, 8, 0.1, 10, 0.15],
    },
    minzoom: 5,
    maxzoom: 10,
  });

  // MORA grid lines
  map.addLayer({
    id: GRID_LAYER_ID,
    type: 'line',
    source: SOURCE_ID,
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'line-color': '#666666',
      'line-width': 0.5,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.2, 8, 0.4, 10, 0.3],
    },
    minzoom: 5,
    maxzoom: 10,
  });

  // MORA altitude labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    filter: ['==', '$type', 'Point'],
    layout: {
      'text-field': ['get', 'altDisplay'],
      'text-font': ['Open Sans Bold'],
      'text-size': ['interpolate', ['linear'], ['zoom'], 5, 8, 8, 11, 10, 14],
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': '#FFFFFF',
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
      'text-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.6, 8, 0.9, 10, 1],
    },
    minzoom: 5,
    maxzoom: 10,
  });
}

function removeMORALayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(GRID_LAYER_ID)) map.removeLayer(GRID_LAYER_ID);
  if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

async function updateMORALayer(map: maplibregl.Map, cells: MORACell[]): Promise<void> {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createMORAGeoJSON(cells));
  } else {
    await addMORALayer(map, cells);
  }
}

function setMORALayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(FILL_LAYER_ID)) map.setLayoutProperty(FILL_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(GRID_LAYER_ID)) map.setLayoutProperty(GRID_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

const MORA_LAYER_IDS = [FILL_LAYER_ID, GRID_LAYER_ID, LABEL_LAYER_ID];
