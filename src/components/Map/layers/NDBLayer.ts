import maplibregl from 'maplibre-gl';
import type { Navaid } from '@/types/navigation';

const LAYER_ID = 'nav-ndbs';
const SOURCE_ID = 'nav-ndbs-source';
const LABEL_LAYER_ID = 'nav-ndbs-labels';

// ICAO standard NDB color - magenta/brown
const NDB_COLOR = '#9933CC';

function createNDBSymbolSVG(size: number = 40): string {
  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = 5;
  const dotRadius = 2;

  // Create radiating dots (every 45 degrees)
  let dots = '';
  for (let ring = 1; ring <= 2; ring++) {
    const ringRadius = innerRadius + ring * 6;
    for (let i = 0; i < 8; i++) {
      const angle = ((i * 45 - 90) * Math.PI) / 180;
      const x = center + ringRadius * Math.cos(angle);
      const y = center + ringRadius * Math.sin(angle);
      dots += `<circle cx="${x}" cy="${y}" r="${dotRadius}" fill="${NDB_COLOR}" opacity="${ring === 1 ? 1 : 0.6}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${outerRadius}" fill="none" stroke="${NDB_COLOR}" stroke-width="1.5" stroke-dasharray="4,3"/>
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="${NDB_COLOR}"/>
    ${dots}
  </svg>`;
}

function svgToDataURL(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadNDBImages(map: maplibregl.Map): Promise<boolean> {
  const id = 'ndb-symbol';
  if (!map.hasImage(id)) {
    try {
      const img = new Image();
      const promise = new Promise<boolean>((resolve) => {
        img.onload = () => {
          if (!map.hasImage(id)) {
            map.addImage(id, img, { sdf: false });
          }
          resolve(true);
        };
        img.onerror = () => {
          resolve(false);
        };
      });
      img.src = svgToDataURL(createNDBSymbolSVG(40));
      return await promise;
    } catch {
      return false;
    }
  }
  return true;
}

function createNDBGeoJSON(ndbs: Navaid[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ndbs.map((ndb) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [ndb.longitude, ndb.latitude],
      },
      properties: {
        id: ndb.id,
        name: ndb.name,
        frequency: ndb.frequency,
        freqDisplay: `${ndb.frequency} kHz`,
      },
    })),
  };
}

export async function addNDBLayer(map: maplibregl.Map, ndbs: Navaid[]): Promise<void> {
  removeNDBLayer(map);
  if (ndbs.length === 0) return;

  const imagesLoaded = await loadNDBImages(map);
  const geoJSON = createNDBGeoJSON(ndbs);

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: geoJSON,
  });

  if (imagesLoaded && map.hasImage('ndb-symbol')) {
    // NDB symbols using custom icon
    map.addLayer({
      id: LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': 'ndb-symbol',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 0.7, 12, 0.9, 16, 1.1],
        'icon-allow-overlap': true,
      },
    });
  } else {
    // Fallback to circle layer
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': NDB_COLOR,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 8, 16, 10],
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }

  // NDB labels
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 8,
    layout: {
      'text-field': ['concat', ['get', 'id'], '\n', ['get', 'freqDisplay']],
      'text-font': ['Open Sans Bold'],
      'text-size': 9,
      'text-offset': [0, 1.8],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': NDB_COLOR,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });
}

export function removeNDBLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
}

export async function updateNDBLayer(map: maplibregl.Map, ndbs: Navaid[]): Promise<void> {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createNDBGeoJSON(ndbs));
  } else {
    await addNDBLayer(map, ndbs);
  }
}

export function setNDBLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
}

export const NDB_LAYER_IDS = [LAYER_ID, LABEL_LAYER_ID];
