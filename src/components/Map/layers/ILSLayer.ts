import maplibregl from 'maplibre-gl';
import type { Navaid } from '@/types/navigation';

const LAYER_ID = 'nav-ils';
const SOURCE_ID = 'nav-ils-source';
const LABEL_LAYER_ID = 'nav-ils-labels';
const CONE_LAYER_ID = 'nav-ils-cone';
const CONE_SOURCE_ID = 'nav-ils-cone-source';
const COURSE_LAYER_ID = 'nav-ils-course';
const COURSE_SOURCE_ID = 'nav-ils-course-source';

const ILS_COLOR = '#FF8800';
const ILS_CONE_COLOR = '#FF8800';

function createILSSymbolSVG(size: number = 36): string {
  const center = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${center},4 ${center - 8},${size - 4} ${center},${size - 12} ${center + 8},${size - 4}" fill="${ILS_COLOR}" stroke="${ILS_COLOR}" stroke-width="1"/>
    <line x1="${center}" y1="4" x2="${center}" y2="${size - 4}" stroke="#000" stroke-width="1.5"/>
  </svg>`;
}

function svgToDataURL(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

async function loadILSImages(map: maplibregl.Map): Promise<boolean> {
  const id = 'ils-symbol';
  if (!map.hasImage(id)) {
    try {
      const img = new Image();
      img.src = svgToDataURL(createILSSymbolSVG(36));
      return await new Promise<boolean>((resolve) => {
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
    } catch {
      return false;
    }
  }
  return true;
}

// Haversine formula - calculates destination point given start, bearing, and distance
function destinationPoint(
  lat: number,
  lon: number,
  bearing: number,
  distanceNm: number
): [number, number] {
  const R = 3440.065;
  const d = distanceNm / R;
  const brng = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return [(lon2 * 180) / Math.PI, (lat2 * 180) / Math.PI];
}

function createILSConeGeoJSON(ilsList: Navaid[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const ils of ilsList) {
    if (ils.bearing === undefined) continue;

    const coneAngle = 2.5; // ILS localizer ~2.5° either side
    const coneLength = 18;
    const course = (ils.bearing + 180) % 360;

    const leftBearing = (course - coneAngle + 360) % 360;
    const rightBearing = (course + coneAngle) % 360;

    const origin: [number, number] = [ils.longitude, ils.latitude];
    const leftPoint = destinationPoint(ils.latitude, ils.longitude, leftBearing, coneLength);
    const rightPoint = destinationPoint(ils.latitude, ils.longitude, rightBearing, coneLength);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[origin, leftPoint, rightPoint, origin]],
      },
      properties: {
        id: ils.id,
        runway: ils.associatedRunway || '',
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

function createILSCourseGeoJSON(ilsList: Navaid[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];

  for (const ils of ilsList) {
    if (ils.bearing === undefined) continue;

    const courseLength = 12;
    const course = (ils.bearing + 180) % 360;

    const origin: [number, number] = [ils.longitude, ils.latitude];
    const endPoint = destinationPoint(ils.latitude, ils.longitude, course, courseLength);

    features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [origin, endPoint],
      },
      properties: {
        id: ils.id,
        runway: ils.associatedRunway || '',
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

function createILSGeoJSON(ilsList: Navaid[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: ilsList.map((ils) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [ils.longitude, ils.latitude],
      },
      properties: {
        id: ils.id,
        name: ils.name,
        frequency: ils.frequency,
        bearing: ils.bearing || 0,
        runway: ils.associatedRunway || '',
        freqDisplay: `${(ils.frequency / 100).toFixed(2)}`,
        rotation: ils.bearing !== undefined ? (ils.bearing + 180) % 360 : 0,
      },
    })),
  };
}

export async function addILSLayer(map: maplibregl.Map, ilsList: Navaid[]): Promise<void> {
  removeILSLayer(map);
  if (ilsList.length === 0) return;

  const imagesLoaded = await loadILSImages(map);

  map.addSource(CONE_SOURCE_ID, {
    type: 'geojson',
    data: createILSConeGeoJSON(ilsList),
  });

  map.addLayer({
    id: CONE_LAYER_ID,
    type: 'fill',
    source: CONE_SOURCE_ID,
    paint: {
      'fill-color': ILS_CONE_COLOR,
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.05, 12, 0.1, 16, 0.15],
    },
  });

  map.addSource(COURSE_SOURCE_ID, {
    type: 'geojson',
    data: createILSCourseGeoJSON(ilsList),
  });

  map.addLayer({
    id: COURSE_LAYER_ID,
    type: 'line',
    source: COURSE_SOURCE_ID,
    paint: {
      'line-color': ILS_COLOR,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3],
      'line-dasharray': [4, 2],
      'line-opacity': 0.8,
    },
  });

  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: createILSGeoJSON(ilsList),
  });

  if (imagesLoaded && map.hasImage('ils-symbol')) {
    map.addLayer({
      id: LAYER_ID,
      type: 'symbol',
      source: SOURCE_ID,
      layout: {
        'icon-image': 'ils-symbol',
        'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 0.7, 16, 1.0],
        'icon-rotate': ['get', 'rotation'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
      },
    });
  } else {
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: SOURCE_ID,
      paint: {
        'circle-color': ILS_COLOR,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 6, 16, 8],
        'circle-stroke-color': '#FFFFFF',
        'circle-stroke-width': 2,
      },
    });
  }

  map.addLayer({
    id: LABEL_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    minzoom: 10,
    layout: {
      'text-field': ['concat', ['get', 'id'], ' ', ['get', 'runway'], '\n', ['get', 'freqDisplay']],
      'text-font': ['Open Sans Semibold'],
      'text-size': 9,
      'text-offset': [0, 1.5],
      'text-anchor': 'top',
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': ILS_COLOR,
      'text-halo-color': '#000000',
      'text-halo-width': 1.5,
    },
  });
}

export function removeILSLayer(map: maplibregl.Map): void {
  if (map.getLayer(LABEL_LAYER_ID)) map.removeLayer(LABEL_LAYER_ID);
  if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
  if (map.getLayer(COURSE_LAYER_ID)) map.removeLayer(COURSE_LAYER_ID);
  if (map.getLayer(CONE_LAYER_ID)) map.removeLayer(CONE_LAYER_ID);
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
  if (map.getSource(COURSE_SOURCE_ID)) map.removeSource(COURSE_SOURCE_ID);
  if (map.getSource(CONE_SOURCE_ID)) map.removeSource(CONE_SOURCE_ID);
}

export async function updateILSLayer(map: maplibregl.Map, ilsList: Navaid[]): Promise<void> {
  const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource;
  if (source) {
    source.setData(createILSGeoJSON(ilsList));
    const coneSource = map.getSource(CONE_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (coneSource) coneSource.setData(createILSConeGeoJSON(ilsList));
    const courseSource = map.getSource(COURSE_SOURCE_ID) as maplibregl.GeoJSONSource;
    if (courseSource) courseSource.setData(createILSCourseGeoJSON(ilsList));
  } else {
    await addILSLayer(map, ilsList);
  }
}

export function setILSLayerVisibility(map: maplibregl.Map, visible: boolean): void {
  const visibility = visible ? 'visible' : 'none';
  if (map.getLayer(LAYER_ID)) map.setLayoutProperty(LAYER_ID, 'visibility', visibility);
  if (map.getLayer(LABEL_LAYER_ID)) map.setLayoutProperty(LABEL_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(COURSE_LAYER_ID))
    map.setLayoutProperty(COURSE_LAYER_ID, 'visibility', visibility);
  if (map.getLayer(CONE_LAYER_ID)) map.setLayoutProperty(CONE_LAYER_ID, 'visibility', visibility);
}

export const ILS_LAYER_IDS = [LAYER_ID, LABEL_LAYER_ID, COURSE_LAYER_ID, CONE_LAYER_ID];
