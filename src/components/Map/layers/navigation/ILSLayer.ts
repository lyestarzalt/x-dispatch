import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import { destinationPoint, nauticalMilesToMeters } from '@/lib/geo';
import { svgToDataUrl } from '@/lib/svg';
import type { Navaid } from '@/types/navigation';
import { removeLayersAndSource, setLayersVisibility } from '../types';
import { NavLayerRenderer } from './NavLayerRenderer';

function createILSSymbolSVG(size: number = 36): string {
  const center = size / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${center},4 ${center - 8},${size - 4} ${center},${size - 12} ${center + 8},${size - 4}" fill="${NAV_COLORS.ils}" stroke="${NAV_COLORS.ils}" stroke-width="1"/>
    <line x1="${center}" y1="4" x2="${center}" y2="${size - 4}" stroke="#000" stroke-width="1.5"/>
  </svg>`;
}

// Helper to calculate destination point using nautical miles
function destinationPointNm(
  lat: number,
  lon: number,
  bearing: number,
  distanceNm: number
): [number, number] {
  return destinationPoint(lat, lon, nauticalMilesToMeters(distanceNm), bearing);
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
    const leftPoint = destinationPointNm(ils.latitude, ils.longitude, leftBearing, coneLength);
    const rightPoint = destinationPointNm(ils.latitude, ils.longitude, rightBearing, coneLength);

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
    const endPoint = destinationPointNm(ils.latitude, ils.longitude, course, courseLength);

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

/**
 * ILS Layer - renders Instrument Landing System navaids with localizer cone
 *
 * This layer is more complex than others because it has multiple sources:
 * - Main source for ILS symbols and labels
 * - Cone source for localizer coverage polygon
 * - Course source for extended centerline
 */
export class ILSLayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-ils';
  readonly sourceId = 'nav-ils-source';
  readonly additionalLayerIds = ['nav-ils-labels', 'nav-ils-cone', 'nav-ils-course'];

  // Additional sources for cone and course
  private readonly coneSourceId = 'nav-ils-cone-source';
  private readonly courseSourceId = 'nav-ils-course-source';

  private imagesLoaded = false;

  protected createGeoJSON(ilsList: Navaid[]): GeoJSON.FeatureCollection {
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

  protected async loadImages(map: maplibregl.Map): Promise<boolean> {
    const id = 'ils-symbol';
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
        img.src = svgToDataUrl(createILSSymbolSVG(36));
        this.imagesLoaded = await promise;
        return this.imagesLoaded;
      } catch {
        this.imagesLoaded = false;
        return false;
      }
    }
    this.imagesLoaded = true;
    return true;
  }

  protected addLayers(map: maplibregl.Map): void {
    // Cone fill layer
    map.addLayer({
      id: this.additionalLayerIds[1], // nav-ils-cone
      type: 'fill',
      source: this.coneSourceId,
      paint: {
        'fill-color': NAV_COLORS.ils,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.05, 12, 0.1, 16, 0.15],
      },
    });

    // Course line layer
    map.addLayer({
      id: this.additionalLayerIds[2], // nav-ils-course
      type: 'line',
      source: this.courseSourceId,
      paint: {
        'line-color': NAV_COLORS.ils,
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3],
        'line-dasharray': [4, 2],
        'line-opacity': 0.8,
      },
    });

    // ILS symbol layer
    if (this.imagesLoaded && map.hasImage('ils-symbol')) {
      map.addLayer({
        id: this.layerId,
        type: 'symbol',
        source: this.sourceId,
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
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-color': NAV_COLORS.ils,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 12, 6, 16, 8],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // ILS labels
    map.addLayer({
      id: this.additionalLayerIds[0], // nav-ils-labels
      type: 'symbol',
      source: this.sourceId,
      minzoom: 10,
      layout: {
        'text-field': [
          'concat',
          ['get', 'id'],
          ' ',
          ['get', 'runway'],
          '\n',
          ['get', 'freqDisplay'],
        ],
        'text-font': ['Open Sans Semibold'],
        'text-size': 9,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': NAV_COLORS.ils,
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    });
  }

  // Override add to handle multiple sources
  async add(map: maplibregl.Map, data: Navaid[]): Promise<void> {
    this.remove(map);
    if (data.length === 0) return;

    await this.loadImages(map);

    // Add cone source
    map.addSource(this.coneSourceId, {
      type: 'geojson',
      data: createILSConeGeoJSON(data),
    });

    // Add course source
    map.addSource(this.courseSourceId, {
      type: 'geojson',
      data: createILSCourseGeoJSON(data),
    });

    // Add main source
    map.addSource(this.sourceId, {
      type: 'geojson',
      data: this.createGeoJSON(data),
    });

    this.addLayers(map);
  }

  // Override update to handle multiple sources
  async update(map: maplibregl.Map, data: Navaid[]): Promise<void> {
    const source = map.getSource(this.sourceId) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData(this.createGeoJSON(data));
      const coneSource = map.getSource(this.coneSourceId) as maplibregl.GeoJSONSource;
      if (coneSource) coneSource.setData(createILSConeGeoJSON(data));
      const courseSource = map.getSource(this.courseSourceId) as maplibregl.GeoJSONSource;
      if (courseSource) courseSource.setData(createILSCourseGeoJSON(data));
    } else {
      await this.add(map, data);
    }
  }

  // Override remove to handle multiple sources
  remove(map: maplibregl.Map): void {
    // Remove main layers and source via base helper
    removeLayersAndSource(map, this.layerId, this.sourceId, this.additionalLayerIds);

    // Remove additional sources
    if (map.getSource(this.coneSourceId)) map.removeSource(this.coneSourceId);
    if (map.getSource(this.courseSourceId)) map.removeSource(this.courseSourceId);
  }

  // Override setVisibility to include all layers
  setVisibility(map: maplibregl.Map, visible: boolean): void {
    setLayersVisibility(map, [this.layerId, ...this.additionalLayerIds], visible);
  }
}

export const ilsLayer = new ILSLayerRenderer();
export const ILS_LAYER_IDS = ilsLayer.getAllLayerIds();
