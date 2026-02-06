import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import { svgToDataUrl } from '@/lib/svg';
import type { Navaid } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

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
      dots += `<circle cx="${x}" cy="${y}" r="${dotRadius}" fill="${NAV_COLORS.ndb}" opacity="${ring === 1 ? 1 : 0.6}"/>`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${center}" cy="${center}" r="${outerRadius}" fill="none" stroke="${NAV_COLORS.ndb}" stroke-width="1.5" stroke-dasharray="4,3"/>
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="${NAV_COLORS.ndb}"/>
    ${dots}
  </svg>`;
}

/**
 * NDB Layer - renders Non-Directional Beacons
 */
export class NDBLayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-ndbs';
  readonly sourceId = 'nav-ndbs-source';
  readonly additionalLayerIds = ['nav-ndbs-labels'];

  private imagesLoaded = false;

  protected createGeoJSON(ndbs: Navaid[]): GeoJSON.FeatureCollection {
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

  protected async loadImages(map: maplibregl.Map): Promise<boolean> {
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
        img.src = svgToDataUrl(createNDBSymbolSVG(40));
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
    if (this.imagesLoaded && map.hasImage('ndb-symbol')) {
      // NDB symbols using custom icon
      map.addLayer({
        id: this.layerId,
        type: 'symbol',
        source: this.sourceId,
        layout: {
          'icon-image': 'ndb-symbol',
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.5, 8, 0.7, 12, 0.9, 16, 1.1],
          'icon-allow-overlap': true,
        },
      });
    } else {
      // Fallback to circle layer
      map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-color': NAV_COLORS.ndb,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 8, 16, 10],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // NDB labels
    map.addLayer({
      id: this.additionalLayerIds[0],
      type: 'symbol',
      source: this.sourceId,
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
        'text-color': NAV_COLORS.ndb,
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    });
  }
}

export const ndbLayer = new NDBLayerRenderer();
export const NDB_LAYER_IDS = ndbLayer.getAllLayerIds();
