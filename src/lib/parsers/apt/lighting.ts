/**
 * Airport Lighting Module
 *
 * Accurate implementation of airport taxiway/runway lighting based on:
 * - FAA AC 150/5340-30H (Design and Installation Details for Airport Visual Aids)
 * - FAA AC 150/5345-46F (Specification for Runway and Taxiway Light Fixtures)
 * - X-Plane apt.dat 12.00 specification
 *
 * Light Type Codes (per apt.dat):
 * 101 - Green bidirectional (taxiway centerline)
 * 102 - Blue omnidirectional (taxiway edge)
 * 103 - Amber unidirectional (clearance bar / intermediate hold)
 * 104 - Amber pulsating unidirectional (runway hold position / stop bar)
 * 105 - Alternating amber/green bidirectional (runway safety zone centerline)
 * 106 - Red omnidirectional (hazard/danger zone)
 * 107 - Green unidirectional (runway lead-off/lead-on)
 * 108 - Alternating amber/green unidirectional (runway safety zone edge)
 *
 * References:
 * - https://pilotinstitute.com/taxiway-lighting/
 * - https://www.faa.gov/documentLibrary/media/Advisory_Circular/150-5340-30H.pdf
 * - https://developer.x-plane.com/article/airport-data-apt-dat-12-00-file-format-specification/
 */
import { calculateBearing, haversineDistance } from '@/lib/utils/geomath';
import { LineLightingType } from '@/types/apt';
import type { LinearFeature } from '@/types/apt';

export interface AirportLight {
  coordinates: [number, number]; // [lon, lat]
  type: LineLightingType;
  color: LightColor;
  isAlternating: boolean;
  alternateIndex: number; // 0 or 1 for alternating lights
  isPulsating: boolean;
  intensity: number; // 0-1
  direction: 'omnidirectional' | 'bidirectional' | 'unidirectional';
  heading?: number; // For unidirectional lights
}

export type LightColor = 'green' | 'blue' | 'amber' | 'red' | 'white';

interface LightingConfig {
  spacingMeters: number;
  color: LightColor;
  alternateColor?: LightColor;
  direction: 'omnidirectional' | 'bidirectional' | 'unidirectional';
  isPulsating: boolean;
  intensity: number;
}

// ============================================================================
// FAA Standard Configurations
// ============================================================================

/**
 * FAA-standard light configurations per type
 * Spacing values from AC 150/5340-30H
 */
const LIGHT_CONFIGS: Record<LineLightingType, LightingConfig> = {
  [LineLightingType.NONE]: {
    spacingMeters: 0,
    color: 'green',
    direction: 'omnidirectional',
    isPulsating: false,
    intensity: 0,
  },

  // 101: Taxiway centerline lights - green, bidirectional
  // FAA standard: 50ft (15m) in straight sections, 25ft (7.5m) on curves
  [LineLightingType.GREEN_BIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 15,
    color: 'green',
    direction: 'bidirectional',
    isPulsating: false,
    intensity: 1.0,
  },

  // 102: Taxiway edge lights - blue, omnidirectional
  // FAA standard: 200ft (60m) max, 50ft (15m) on curves
  // Using 10m for slightly denser visualization
  [LineLightingType.BLUE_OMNIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 10,
    color: 'blue',
    direction: 'omnidirectional',
    isPulsating: false,
    intensity: 1.2,
  },

  // 103: Clearance bar / intermediate hold - amber, unidirectional
  // FAA standard: 3 lights in a row, closely spaced (1ft / 0.3m apart)
  [LineLightingType.AMBER_UNIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 0.3,
    color: 'amber',
    direction: 'unidirectional',
    isPulsating: false,
    intensity: 1.0,
  },

  // 104: Stop bar / runway hold position - amber, pulsating, unidirectional
  // FAA standard: Lights spaced 1ft (0.3m) apart across full taxiway width
  [LineLightingType.AMBER_UNIDIRECTIONAL_PULSATING_LIGHTS]: {
    spacingMeters: 0.3,
    color: 'amber',
    direction: 'unidirectional',
    isPulsating: true,
    intensity: 1.2,
  },

  // 105: Runway safety zone centerline - alternating amber/green, bidirectional
  // FAA standard: Alternating colors, 50ft (15m) spacing
  [LineLightingType.ALTERNATING_AMBER_GREEN_BIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 15,
    color: 'green',
    alternateColor: 'amber',
    direction: 'bidirectional',
    isPulsating: false,
    intensity: 1.0,
  },

  // 106: Hazard/danger zone - red, omnidirectional
  // Used on bridges, near jet blast areas, etc.
  [LineLightingType.RED_OMNIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 15,
    color: 'red',
    direction: 'omnidirectional',
    isPulsating: false,
    intensity: 1.0,
  },

  // 107: Runway lead-off/lead-on - green, unidirectional
  // FAA standard: Guides aircraft exiting runway, closely spaced
  [LineLightingType.GREEN_UNIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 3,
    color: 'green',
    direction: 'unidirectional',
    isPulsating: false,
    intensity: 1.0,
  },

  // 108: Runway safety zone edge - alternating amber/green, unidirectional
  // Inside ILS critical area, alternating colors
  [LineLightingType.ALTERNATING_AMBER_GREEN_UNIDIRECTIONAL_LIGHTS]: {
    spacingMeters: 3,
    color: 'green',
    alternateColor: 'amber',
    direction: 'unidirectional',
    isPulsating: false,
    intensity: 1.0,
  },
};

export const LIGHT_COLORS: Record<LightColor, { hex: string; glow: string }> = {
  green: {
    hex: '#00E676', // Aviation green (slightly brighter than pure green)
    glow: 'rgba(0, 230, 118, 0.6)',
  },
  blue: {
    hex: '#2196F3', // Aviation blue (taxiway edge standard)
    glow: 'rgba(33, 150, 243, 0.6)',
  },
  amber: {
    hex: '#FFB300', // Aviation amber/yellow
    glow: 'rgba(255, 179, 0, 0.7)',
  },
  red: {
    hex: '#F44336', // Aviation red
    glow: 'rgba(244, 67, 54, 0.6)',
  },
  white: {
    hex: '#FFFFFF',
    glow: 'rgba(255, 255, 255, 0.6)',
  },
};

// ============================================================================
// Geodesic Utilities (imported from centralized lib/geo)
// ============================================================================

function interpolatePoint(
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number,
  ratio: number
): [number, number] {
  return [lon1 + (lon2 - lon1) * ratio, lat1 + (lat2 - lat1) * ratio];
}

function generateLightsAlongPath(
  coordinates: [number, number][],
  lightingType: LineLightingType
): AirportLight[] {
  if (lightingType === LineLightingType.NONE || coordinates.length < 2) {
    return [];
  }

  const config = LIGHT_CONFIGS[lightingType];
  if (!config || config.spacingMeters === 0) {
    return [];
  }

  const lights: AirportLight[] = [];
  let accumulatedDistance = 0;
  let lightIndex = 0;

  // Walk along the path and place lights at proper intervals
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lon1, lat1] = coordinates[i];
    const [lon2, lat2] = coordinates[i + 1];

    const segmentLength = haversineDistance(lat1, lon1, lat2, lon2);
    const heading = calculateBearing(lat1, lon1, lat2, lon2);

    let distanceInSegment = config.spacingMeters - accumulatedDistance;

    while (distanceInSegment <= segmentLength) {
      const ratio = distanceInSegment / segmentLength;
      const [lon, lat] = interpolatePoint(lon1, lat1, lon2, lat2, ratio);

      // Determine color (handles alternating lights)
      const isAlternate = config.alternateColor && lightIndex % 2 === 1;
      const color = isAlternate ? config.alternateColor! : config.color;

      lights.push({
        coordinates: [lon, lat],
        type: lightingType,
        color,
        isAlternating: !!config.alternateColor,
        alternateIndex: lightIndex % 2,
        isPulsating: config.isPulsating,
        intensity: config.intensity,
        direction: config.direction,
        heading: config.direction === 'unidirectional' ? heading : undefined,
      });

      lightIndex++;
      distanceInSegment += config.spacingMeters;
    }

    accumulatedDistance = segmentLength - (distanceInSegment - config.spacingMeters);
  }

  return lights;
}

export function generateAirportLights(linearFeatures: LinearFeature[]): AirportLight[] {
  const allLights: AirportLight[] = [];

  for (const feature of linearFeatures) {
    const lightingType = feature.lighting_line_type as LineLightingType;
    if (lightingType === LineLightingType.NONE) continue;

    const lights = generateLightsAlongPath(feature.coordinates, lightingType);
    allLights.push(...lights);
  }

  return allLights;
}

function lightsToGeoJSON(lights: AirportLight[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: lights.map((light, index) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: light.coordinates,
      },
      properties: {
        id: index,
        lightType: light.type,
        color: light.color,
        colorHex: LIGHT_COLORS[light.color].hex,
        glowColor: LIGHT_COLORS[light.color].glow,
        isAlternating: light.isAlternating,
        alternateIndex: light.alternateIndex,
        isPulsating: light.isPulsating,
        intensity: light.intensity,
        direction: light.direction,
        heading: light.heading,
      },
    })),
  };
}

function buildLightColorExpression(): maplibregl.ExpressionSpecification {
  return ['get', 'colorHex'] as maplibregl.ExpressionSpecification;
}

function buildLightRadiusExpression(): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    14,
    ['*', 2, ['get', 'intensity']],
    16,
    ['*', 4, ['get', 'intensity']],
    18,
    ['*', 6, ['get', 'intensity']],
    20,
    ['*', 8, ['get', 'intensity']],
  ] as maplibregl.ExpressionSpecification;
}

function buildGlowRadiusExpression(): maplibregl.ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['zoom'],
    14,
    ['*', 6, ['get', 'intensity']],
    16,
    ['*', 10, ['get', 'intensity']],
    18,
    ['*', 14, ['get', 'intensity']],
    20,
    ['*', 20, ['get', 'intensity']],
  ] as maplibregl.ExpressionSpecification;
}
