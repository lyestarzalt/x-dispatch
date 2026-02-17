import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import { svgToDataUrl } from '@/lib/utils/helpers';
import type { Navaid } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

function createVORSymbolSVG(size: number = 48): string {
  const center = size / 2;
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.7;
  const tickLength = 4;

  const hexPoints: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    hexPoints.push(`${x},${y}`);
  }

  let ticks = '';
  for (let i = 0; i < 12; i++) {
    const angle = ((i * 30 - 90) * Math.PI) / 180;
    const x1 = center + innerRadius * Math.cos(angle);
    const y1 = center + innerRadius * Math.sin(angle);
    const tickLen = i % 3 === 0 ? tickLength * 1.5 : tickLength;
    const x2 = center + (innerRadius + tickLen) * Math.cos(angle);
    const y2 = center + (innerRadius + tickLen) * Math.sin(angle);
    ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${NAV_COLORS.vor}" stroke-width="2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${hexPoints.join(' ')}" fill="none" stroke="${NAV_COLORS.vor}" stroke-width="2"/>
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="none" stroke="${NAV_COLORS.vor}" stroke-width="1.5"/>
    ${ticks}
    <circle cx="${center}" cy="${center}" r="3" fill="${NAV_COLORS.vor}"/>
  </svg>`;
}

function createVORTACSymbolSVG(size: number = 48): string {
  const center = size / 2;
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.6;

  const hexPoints: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    hexPoints.push(`${x},${y}`);
  }

  let lines = '';
  for (let i = 0; i < 3; i++) {
    const angle = ((i * 120 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    lines += `<line x1="${center}" y1="${center}" x2="${x}" y2="${y}" stroke="${NAV_COLORS.vortac}" stroke-width="2"/>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${hexPoints.join(' ')}" fill="none" stroke="${NAV_COLORS.vortac}" stroke-width="2.5"/>
    ${lines}
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="none" stroke="${NAV_COLORS.vortac}" stroke-width="1.5"/>
    <circle cx="${center}" cy="${center}" r="4" fill="${NAV_COLORS.vortac}"/>
  </svg>`;
}

function createVORDMESymbolSVG(size: number = 48): string {
  const center = size / 2;
  const outerRadius = size / 2 - 2;
  const innerRadius = outerRadius * 0.5;

  const hexPoints: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = ((i * 60 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    hexPoints.push(`${x},${y}`);
  }

  const squareSize = innerRadius * 1.2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${hexPoints.join(' ')}" fill="none" stroke="${NAV_COLORS.vorDme}" stroke-width="2"/>
    <rect x="${center - squareSize / 2}" y="${center - squareSize / 2}" width="${squareSize}" height="${squareSize}" fill="none" stroke="${NAV_COLORS.vorDme}" stroke-width="1.5" transform="rotate(45 ${center} ${center})"/>
    <circle cx="${center}" cy="${center}" r="3" fill="${NAV_COLORS.vorDme}"/>
  </svg>`;
}

/**
 * VOR Layer - renders VOR, VORTAC, and VOR-DME navaids
 */
export class VORLayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-vors';
  readonly sourceId = 'nav-vors-source';
  readonly additionalLayerIds = ['nav-vors-labels'];

  private imagesLoaded = false;

  protected createGeoJSON(vors: Navaid[]): GeoJSON.FeatureCollection {
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

  protected async loadImages(map: maplibregl.Map): Promise<boolean> {
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
          img.src = svgToDataUrl(svg);
          await promise;
        } catch {
          allLoaded = false;
        }
      }
    }

    this.imagesLoaded = allLoaded;
    return allLoaded;
  }

  protected addLayers(map: maplibregl.Map): void {
    const labelsLayerId = this.additionalLayerIds[0];
    if (!labelsLayerId) return;

    if (this.imagesLoaded && map.hasImage('vor-symbol')) {
      map.addLayer({
        id: this.layerId,
        type: 'symbol',
        source: this.sourceId,
        layout: {
          'icon-image': ['get', 'symbolType'],
          'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.4, 8, 0.6, 12, 0.8, 16, 1.0],
          'icon-allow-overlap': true,
        },
      });
    } else {
      // Fallback to circle layer if images failed to load
      map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-color': NAV_COLORS.vor,
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 8, 16, 10],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // VOR labels
    map.addLayer({
      id: labelsLayerId,
      type: 'symbol',
      source: this.sourceId,
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
        'text-color': NAV_COLORS.vor,
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    });
  }
}

export const vorLayer = new VORLayerRenderer();
export const VOR_LAYER_IDS = vorLayer.getAllLayerIds();
