import maplibregl from 'maplibre-gl';
import type { ParsedAirport } from '@/types/apt';
import type { Helipad, StartupLocation } from '@/types/apt';
import { BaseLayerRenderer } from './BaseLayerRenderer';

// Gate colors - simplified X-Plane design system
// All gates use same muted color, selected uses primary cyan
const GATE_COLORS = {
  default: '#64748b', // Muted gray
  hover: '#94a3b8', // Lighter gray
  selected: '#1DA0F2', // Primary cyan
} as const;

// Gate type definitions - icons only, color is unified
const GATE_TYPES = {
  gate: { icon: 'gate-airliner' },
  cargo: { icon: 'gate-cargo' },
  tie_down: { icon: 'gate-ga' },
  hangar: { icon: 'gate-hangar' },
  fuel: { icon: 'gate-fuel' },
  helicopter: { icon: 'gate-heli' },
  helipad: { icon: 'gate-helipad' },
  misc: { icon: 'gate-ga' },
} as const;

type GateType = keyof typeof GATE_TYPES;

// SVG icons for each gate type (top-down silhouettes, 48x48 viewbox)
const GATE_ICONS: Record<string, string> = {
  // Commercial airliner - swept wings, twin engines
  'gate-airliner': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <path fill="white" d="M24 4c-1.1 0-2 .9-2 2v12l-14 8v3l14-4v10l-4 3v2l6-2 6 2v-2l-4-3V25l14 4v-3l-14-8V6c0-1.1-.9-2-2-2z"/>
  </svg>`,

  // Cargo freighter - wider body, box indicator
  'gate-cargo': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <path fill="white" d="M24 4c-1.5 0-2.5.9-2.5 2v10l-14 9v4l14-4v8l-4 3v3l6.5-2 6.5 2v-3l-4-3v-8l14 4v-4l-14-9V6c0-1.1-1-2-2.5-2z"/>
    <rect fill="white" x="20" y="18" width="8" height="6" rx="1" opacity="0.6"/>
  </svg>`,

  // General aviation - high-wing single prop (Cessna style)
  'gate-ga': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <path fill="white" d="M24 6c-.8 0-1.5.7-1.5 1.5v5L8 16v2l14.5-2v16l-5 4v2l6.5-1.5 6.5 1.5v-2l-5-4V16L40 18v-2l-14.5-3.5v-5c0-.8-.7-1.5-1.5-1.5z"/>
    <circle fill="white" cx="24" cy="8" r="2"/>
  </svg>`,

  // Hangar - building with roof
  'gate-hangar': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <path fill="white" d="M24 8L8 18v22h32V18L24 8zm0 4l12 8v16H12V20l12-8z"/>
    <rect fill="white" x="18" y="28" width="12" height="10" opacity="0.5"/>
  </svg>`,

  // Fuel - fuel pump/droplet
  'gate-fuel': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <path fill="white" d="M24 6c-1 0-1.8.5-2.3 1.2L12 22c-2 3-3 6-3 9 0 7 6.7 13 15 13s15-6 15-13c0-3-1-6-3-9L26.3 7.2C25.8 6.5 25 6 24 6zm0 6l8 12c1.3 2 2 4 2 6 0 5-4.5 9-10 9s-10-4-10-9c0-2 .7-4 2-6l8-12z"/>
    <circle fill="white" cx="24" cy="32" r="4" opacity="0.6"/>
  </svg>`,

  // Helicopter - rotor disk with body
  'gate-heli': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <circle fill="white" cx="24" cy="20" r="14" opacity="0.3" stroke="white" stroke-width="2"/>
    <ellipse fill="white" cx="24" cy="24" rx="4" ry="8"/>
    <path fill="white" d="M20 32h8l2 8h-12l2-8z"/>
    <rect fill="white" x="14" y="38" width="20" height="3" rx="1"/>
    <line stroke="white" stroke-width="2" x1="24" y1="6" x2="24" y2="34"/>
    <line stroke="white" stroke-width="2" x1="10" y1="20" x2="38" y2="20"/>
  </svg>`,

  // Helipad - just H letter
  'gate-helipad': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
    <path fill="white" d="M12 8v32h6V28h12v12h6V8h-6v14H18V8z"/>
  </svg>`,
};

export class GateLayer extends BaseLayerRenderer {
  layerId = 'airport-gates';
  sourceId = 'airport-gates';
  additionalLayerIds = ['airport-gate-labels', 'airport-gates-ring'];

  hasData(airport: ParsedAirport): boolean {
    const hasGates = airport.startupLocations && airport.startupLocations.length > 0;
    const hasHelipads = airport.helipads && airport.helipads.length > 0;
    return hasGates || hasHelipads;
  }

  render(map: maplibregl.Map, airport: ParsedAirport): void {
    if (!this.hasData(airport)) return;

    this.loadGateIcons(map);

    const geoJSON = this.createGeoJSON(airport.startupLocations, airport.helipads);
    this.addSource(map, geoJSON);

    // Ring layer with unified colors (bottom)
    this.addLayer(map, {
      id: 'airport-gates-ring',
      type: 'circle',
      source: this.sourceId,
      minzoom: 15,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 15, 12, 17, 16, 19, 22],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          GATE_COLORS.selected,
          ['boolean', ['feature-state', 'hover'], false],
          GATE_COLORS.hover,
          GATE_COLORS.default,
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          0.95,
          ['boolean', ['feature-state', 'hover'], false],
          0.85,
          0.7,
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          2.5,
          ['boolean', ['feature-state', 'hover'], false],
          1.5,
          1,
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          GATE_COLORS.selected,
          ['boolean', ['feature-state', 'hover'], false],
          '#ffffff',
          GATE_COLORS.hover,
        ],
      },
    });

    // Icon layer with type-based icons
    this.addLayer(map, {
      id: this.layerId,
      type: 'symbol',
      source: this.sourceId,
      minzoom: 15,
      layout: {
        'icon-image': ['get', 'iconName'],
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          15,
          ['*', ['get', 'iconScale'], 0.3],
          17,
          ['*', ['get', 'iconScale'], 0.45],
          19,
          ['*', ['get', 'iconScale'], 0.6],
        ],
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {
        'icon-color': '#ffffff',
        'icon-opacity': 1,
      },
    });

    // Labels
    this.addLayer(map, {
      id: 'airport-gate-labels',
      type: 'symbol',
      source: this.sourceId,
      minzoom: 17,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Open Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 17, 11, 19, 14],
        'text-offset': [0, 1.8],
        'text-anchor': 'top',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false],
          GATE_COLORS.selected,
          '#e2e8f0',
        ],
        'text-halo-color': '#0f172a',
        'text-halo-width': 1.5,
      },
    });
  }

  private loadGateIcons(map: maplibregl.Map): void {
    for (const [iconName, svgContent] of Object.entries(GATE_ICONS)) {
      if (map.hasImage(iconName)) continue;

      const img = new Image(48, 48);
      img.onload = () => {
        if (!map.hasImage(iconName)) {
          map.addImage(iconName, img, { sdf: true });
        }
      };
      img.src = 'data:image/svg+xml,' + encodeURIComponent(svgContent);
    }
  }

  private createGeoJSON(
    locations: StartupLocation[],
    helipads: Helipad[]
  ): GeoJSON.FeatureCollection {
    const locationFeatures = (locations || []).map((location, index) => {
      const gateType = this.normalizeGateType(location.location_type, location.airplane_types);
      const typeConfig = GATE_TYPES[gateType];

      return {
        type: 'Feature' as const,
        id: index,
        geometry: {
          type: 'Point' as const,
          coordinates: [location.longitude, location.latitude],
        },
        properties: {
          id: index,
          name: location.name,
          locationType: location.location_type,
          gateType,
          heading: location.heading,
          airplaneTypes: location.airplane_types,
          iconScale: this.getIconScale(location.airplane_types),
          iconName: typeConfig.icon,
          latitude: location.latitude,
          longitude: location.longitude,
        },
      };
    });

    const helipadFeatures = (helipads || []).map((helipad, index) => {
      const typeConfig = GATE_TYPES.helipad;
      const featureId = locationFeatures.length + index;

      return {
        type: 'Feature' as const,
        id: featureId,
        geometry: {
          type: 'Point' as const,
          coordinates: [helipad.longitude, helipad.latitude],
        },
        properties: {
          id: featureId,
          name: helipad.name,
          locationType: 'helipad',
          gateType: 'helipad' as GateType,
          heading: helipad.heading,
          airplaneTypes: 'F',
          iconScale: 1.0,
          iconName: typeConfig.icon,
          latitude: helipad.latitude,
          longitude: helipad.longitude,
        },
      };
    });

    return {
      type: 'FeatureCollection',
      features: [...locationFeatures, ...helipadFeatures],
    };
  }

  private normalizeGateType(locationType: string, airplaneTypes: string): GateType {
    const type = locationType?.toLowerCase() || '';

    // Check for helicopter first (airplane_types contains F)
    if (airplaneTypes?.toUpperCase().includes('F') && !airplaneTypes.match(/[A-E]/i)) {
      return 'helicopter';
    }

    // Map location types
    if (type.includes('gate') || type.includes('jet_bridge')) return 'gate';
    if (type.includes('cargo')) return 'cargo';
    if (type.includes('tie_down') || type.includes('tiedown')) return 'tie_down';
    if (type.includes('hangar')) return 'hangar';
    if (type.includes('fuel')) return 'fuel';
    if (type.includes('misc')) return 'misc';

    // Default based on aircraft size
    const types = airplaneTypes?.toUpperCase() || '';
    if (types.match(/[ABC]/)) return 'gate'; // Large aircraft = gate
    return 'tie_down'; // Small aircraft = tie-down
  }

  private getIconScale(airplaneTypes: string): number {
    if (!airplaneTypes) return 1.0;
    const types = airplaneTypes.toUpperCase();
    if (types.includes('A')) return 1.6;
    if (types.includes('B')) return 1.4;
    if (types.includes('C')) return 1.2;
    if (types.includes('D')) return 1.0;
    if (types.includes('E')) return 0.85;
    if (types.includes('F')) return 0.75;
    return 1.0;
  }
}
