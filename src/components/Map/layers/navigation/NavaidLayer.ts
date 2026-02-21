/**
 * Consolidated Navaid Layer
 * Renders all radio navigation aids: VOR, VORTAC, VOR-DME, NDB, DME, TACAN
 */
import maplibregl from 'maplibre-gl';
import { NAV_COLORS } from '@/config/navLayerConfig';
import { svgToDataUrl } from '@/lib/utils/helpers';
import type { Navaid } from '@/types/navigation';
import { NavLayerRenderer } from './NavLayerRenderer';

// ============================================================================
// SVG Symbol Generators
// ============================================================================

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

function createNDBSymbolSVG(size: number = 40): string {
  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = 5;
  const dotRadius = 2;

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

function createDMESymbolSVG(size: number = 32): string {
  const center = size / 2;
  const outerRadius = size / 2 - 4;
  const innerRadius = outerRadius * 0.5;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect x="${center - outerRadius}" y="${center - outerRadius}" width="${outerRadius * 2}" height="${outerRadius * 2}" fill="none" stroke="${NAV_COLORS.dme}" stroke-width="2" transform="rotate(45 ${center} ${center})"/>
    <circle cx="${center}" cy="${center}" r="${innerRadius}" fill="none" stroke="${NAV_COLORS.dme}" stroke-width="1.5"/>
    <circle cx="${center}" cy="${center}" r="2" fill="${NAV_COLORS.dme}"/>
  </svg>`;
}

function createTACANSymbolSVG(size: number = 40): string {
  const center = size / 2;
  const outerRadius = size / 2 - 4;

  // Three pointed star shape
  let points = '';
  for (let i = 0; i < 3; i++) {
    const angle = ((i * 120 - 90) * Math.PI) / 180;
    const x = center + outerRadius * Math.cos(angle);
    const y = center + outerRadius * Math.sin(angle);
    points += `${x},${y} `;
    // Inner point
    const innerAngle = ((i * 120 + 60 - 90) * Math.PI) / 180;
    const ix = center + outerRadius * 0.4 * Math.cos(innerAngle);
    const iy = center + outerRadius * 0.4 * Math.sin(innerAngle);
    points += `${ix},${iy} `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <polygon points="${points.trim()}" fill="none" stroke="${NAV_COLORS.dme}" stroke-width="2"/>
    <circle cx="${center}" cy="${center}" r="4" fill="${NAV_COLORS.dme}"/>
  </svg>`;
}

// ============================================================================
// Symbol Type Mapping
// ============================================================================

type NavaidSymbolType = 'vor' | 'vortac' | 'vor-dme' | 'ndb' | 'dme' | 'tacan';

function getSymbolType(navaid: Navaid): NavaidSymbolType {
  switch (navaid.type) {
    case 'VORTAC':
      return 'vortac';
    case 'VOR-DME':
      return 'vor-dme';
    case 'NDB':
      return 'ndb';
    case 'DME':
      return 'dme';
    case 'TACAN':
      return 'tacan';
    default:
      return 'vor';
  }
}

function getNavaidColor(navaid: Navaid): string {
  switch (navaid.type) {
    case 'VORTAC':
      return NAV_COLORS.vortac;
    case 'VOR-DME':
      return NAV_COLORS.vorDme;
    case 'NDB':
      return NAV_COLORS.ndb;
    case 'DME':
    case 'TACAN':
      return NAV_COLORS.dme;
    default:
      return NAV_COLORS.vor;
  }
}

function formatFrequency(navaid: Navaid): string {
  if (navaid.type === 'NDB') {
    return `${navaid.frequency} kHz`;
  }
  return `${(navaid.frequency / 100).toFixed(2)}`;
}

// ============================================================================
// Navaid Layer Renderer
// ============================================================================

/**
 * Consolidated Navaid Layer
 * Renders VOR, VORTAC, VOR-DME, NDB, DME, and TACAN navaids
 */
export class NavaidLayerRenderer extends NavLayerRenderer<Navaid> {
  readonly layerId = 'nav-navaids';
  readonly sourceId = 'nav-navaids-source';
  readonly additionalLayerIds = ['nav-navaids-labels'];

  private imagesLoaded = false;

  protected createGeoJSON(navaids: Navaid[]): GeoJSON.FeatureCollection {
    return {
      type: 'FeatureCollection',
      features: navaids.map((navaid) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [navaid.longitude, navaid.latitude],
        },
        properties: {
          id: navaid.id,
          name: navaid.name,
          type: navaid.type,
          frequency: navaid.frequency,
          freqDisplay: formatFrequency(navaid),
          symbolType: `navaid-${getSymbolType(navaid)}`,
          color: getNavaidColor(navaid),
        },
      })),
    };
  }

  protected async loadImages(map: maplibregl.Map): Promise<boolean> {
    const symbols = [
      { id: 'navaid-vor', svg: createVORSymbolSVG(48) },
      { id: 'navaid-vortac', svg: createVORTACSymbolSVG(48) },
      { id: 'navaid-vor-dme', svg: createVORDMESymbolSVG(48) },
      { id: 'navaid-ndb', svg: createNDBSymbolSVG(40) },
      { id: 'navaid-dme', svg: createDMESymbolSVG(32) },
      { id: 'navaid-tacan', svg: createTACANSymbolSVG(40) },
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

    if (this.imagesLoaded) {
      // Symbol layer with custom icons
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
      // Fallback to colored circles
      map.addLayer({
        id: this.layerId,
        type: 'circle',
        source: this.sourceId,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 4, 8, 6, 12, 8, 16, 10],
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
        },
      });
    }

    // Labels
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
        'text-color': ['get', 'color'],
        'text-halo-color': '#000000',
        'text-halo-width': 1.5,
      },
    });
  }
}

export const navaidLayer = new NavaidLayerRenderer();
export const NAVAID_LAYER_IDS = navaidLayer.getAllLayerIds();
