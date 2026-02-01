import maplibregl from 'maplibre-gl';
import type { Navaid } from '@/types/navigation';

const LAYER_ID = 'nav-vors';
const SOURCE_ID = 'nav-vors-source';
const LABEL_LAYER_ID = 'nav-vors-labels';
const COMPASS_LAYER_ID = 'nav-vors-compass';

const VOR_COLOR = '#0066CC';
const VOR_DME_COLOR = '#0088FF';
const VORTAC_COLOR = '#0044AA';

function createVORSymbolSVG(size: number = 48): string {
  const center = size / 2;
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.7;
  const tickLength = 4;

  // Create hexagon points
  const hexPoints: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    hexPoints.push(`${x},${y}`);
  }

  // Create compass tick marks (every 30 degrees)
  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const angle = ((i * 30 - 90) * Math.PI) / 180;
    const x1 = center + innerRadius * Math.cos(angle);
    const y1 = center + innerRadius * Math.sin(angle);
    const tickLen = i % 3 === 0 ? tickLength * 1.5 : tickLength;
    const x2 = center + (innerRadius + tickLen) * Math.cos(angle);
    const y2 = center + (innerRadius + tickLen) * Math.sin(angle);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${VOR_COLOR}" stroke-width="2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${hexPoints.join(' ')}" fill="none" stroke="${VOR_COLOR}" stroke-width="2"/>
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="none" stroke="${VOR_COLOR}" stroke-width="1.5"/>
    ${ticks}
    <circle cx="${center}" cy="${center}" r="3" fill="${VOR_COLOR}"/>
  </svg>`;
}

function createVORTACSymbolSVG(size: number = 48): string {
  const center = size / 2;
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.6;

  // Create hexagon points
  const hexPoints: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    hexPoints.push(`${x},${y}`);
  }

  // Create three lines (every 120 degrees)
  let lines = '';
  for (let i = 0; i < 3; i++) {
    const angle = ((i * 120 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    lines += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${VORTAC_COLOR}" stroke-width="2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${hexPoints.join(' ')}" fill="none" stroke="${VORTAC_COLOR}" stroke-width="2.5"/>
    ${lines}
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="none" stroke="${VORTAC_COLOR}" stroke-width="1.5"/>
    <circle cx="${center}" cy="${center}" r="4" fill="${VORTAC_COLOR}"/>
  </svg>`;
}

function createVORDMESymbolSVG(size: number = 48): string {
  const center = size / 2;
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.5;

  // Create hexagon points
  const hexPoints: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    hexPoints.push(`${x},${y}`);
  }

  const squareSize = innerRadius * 1.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${hexPoints.join(' ')}" fill="none" stroke="${VOR_DME_COLOR}" stroke-width="2"/>
    <rect x="${center - squareSize / 2}" y="${center - squareSize / 2}" width="${squareSize}" height="${squareSize}" fill="none" stroke="${VOR_DME_COLOR}" stroke-width="1.5" transform="rotate(45 ${center} ${center})"/>
    <circle cx="${center}" cy="${center}" r="3" fill="${VOR_DME_COLOR}"/>
  </svg>`;
}

function svgToDataURL(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadVORImages(map: maplibregl.Map): Promise<boolean> {
  const symbols = [
    { id: 'vor-symbol', svg: createVORSymbolSVG(48) },
    { id: 'vortac-symbol', svg: createVORTACSymbolSVG(48) },
    { id: 'vor-dme-symbol', svg: createVORDMESymbolSVG(48) },
  ];

  let allLoaded = true;

  for (const { id, svg } of symbols) {
    if (!map.hasImage(id)) {
      try {
        const img = new Image();
        const promise = new Promise<void>((resolve) => {
          img.onload = () => {
            if (!map.hasImage(id)) {
              map.addImage(id, img, { sdf: false });
            }
            resolve();
          };
          img.onerror = () => {
            allLoaded = false;
            resolve();
          };
        });
        img.src = svgToDataURL(svg);
        await promise;
      } catch {
        allLoaded = false;
      }
    }
  }

  return allLoaded;
}

function createVORGeoJSON(vors: Navaid[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: vors.map((vor) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [vor.longitude, vor.latitude],
      },
      properties: {
        id: vor.id,
        name: vor.name,
        type: vor.type,
        frequency: vor.frequency,
        freqDisplay: `${(vor.frequency / 100).toFixed(2)}`,
        symbolType:
          vor.type === 'VORTAC'
            ? 'vortac-symbol'
            : vor.type === 'VOR-DME'
              ? 'vor-dme-symbol'
              : 'vor-symbol',
      },
    })),
  };
}

export async function addVORLayer(map: maplibregl.Map, vors: Navaid[]): Promise<void> {
  removeVORLayer(map);
  if (vors.length === 0) return;

  const imagesLoaded = await loadVORImages(map);
  const geoJSON = createVORGeoJSON(vors);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  if (imagesLoaded && map.hasImage('vor-symbol')) {
    // VOR symbols using custom icons
    map.addLayer({
      id: LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': ['get', 'symbolType'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 8, 0.6, 12, 0.8, 16, 1.0],
        'icon-allow-overlap': true,
      },
    });
  } else {
    // Fallback to circle layer if images failed to load
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': VOR_COLOR,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 8, 16, 10],
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }

  // VOR labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 7,
    layout: {
      'text-field': ['concat', ['get', 'id'], '\n', ['get', 'freqDisplay']],
      'text-font': ['Open Sans Bold'],
      'text-size': 10,
      'text-offset': [0, 2],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': VOR_COLOR,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });
}

export function removeVORLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export async function updateVORLayer(map: maplibregl.Map, vors: Navaid[]): Promise<void> {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createVORGeoJSON(vors));
  } else {
    await addVORLayer(map, vors);
  }
}

export function setVORLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

export const VOR_LAYER_IDS = [LAYER_ID, LABEL_LAYER_ID];
