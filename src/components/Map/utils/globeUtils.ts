import maplibregl from 'maplibre-gl';

const TERRAIN_SOURCE_ID = 'terrain-dem';
const TERRAIN_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export function setupGlobeProjection(map: maplibregl.Map): void {
  map.setProjection({ type: 'globe' });
  map.setSky({
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
  });
}

export function setup3DTerrain(map: maplibregl.Map): void {
  if (map.getSource(TERRAIN_SOURCE_ID)) return;

  map.addSource(TERRAIN_SOURCE_ID, {
    type: 'raster-dem',
    encoding: 'terrarium',
    tiles: [TERRAIN_TILES_URL],
    tileSize: 256,
    maxzoom: 15,
  });

  map.addControl(
    new maplibregl.TerrainControl({ source: TERRAIN_SOURCE_ID, exaggeration: 1 }),
    'bottom-left'
  );
}
