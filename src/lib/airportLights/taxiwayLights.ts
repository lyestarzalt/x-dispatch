import { calculateBearing, destinationPoint, haversineDistance } from '@/lib/utils/geomath';
import { LineLightingType, type LinearFeature } from '@/types/apt';

export type LightColor = 'white' | 'amber' | 'green' | 'blue' | 'red';

export interface LightRule {
  colors: LightColor[];
  spacingM: number;
  /** Lateral offset from the painted line in metres, positive to the right. */
  offsetM: number;
  pulse: boolean;
}

/**
 * apt.dat 100-series light codes and how the fixtures sit along the line.
 * Amber hold bars (103, 104) are left out: a lit bar every 3 m reads as a
 * solid glowing block at map scale.
 */
export const LIGHT_RULES: Partial<Record<LineLightingType, LightRule>> = {
  [LineLightingType.GREEN_BIDIRECTIONAL_LIGHTS]: {
    colors: ['green'],
    spacingM: 15,
    offsetM: 0,
    pulse: false,
  },
  [LineLightingType.GREEN_UNIDIRECTIONAL_LIGHTS]: {
    colors: ['green'],
    spacingM: 15,
    offsetM: 0,
    pulse: false,
  },
  [LineLightingType.BLUE_OMNIDIRECTIONAL_LIGHTS]: {
    colors: ['blue'],
    spacingM: 30,
    offsetM: 0,
    pulse: false,
  },
  [LineLightingType.ALTERNATING_AMBER_GREEN_BIDIRECTIONAL_LIGHTS]: {
    colors: ['amber', 'green'],
    spacingM: 15,
    offsetM: 0,
    pulse: false,
  },
  [LineLightingType.ALTERNATING_AMBER_GREEN_UNIDIRECTIONAL_LIGHTS]: {
    colors: ['amber', 'green'],
    spacingM: 15,
    offsetM: 0,
    pulse: false,
  },
  [LineLightingType.RED_OMNIDIRECTIONAL_LIGHTS]: {
    colors: ['red'],
    spacingM: 3,
    offsetM: 0,
    pulse: false,
  },
};

export interface LightPointProps {
  color: LightColor;
  pulse: boolean;
  /** Radius multiplier for fixtures larger than a taxiway light. */
  size?: number;
}

/**
 * Drops one fixture every `spacingM` along each lit segment, carrying the
 * spacing remainder across vertices so bends do not bunch the lights.
 */
export function taxiwayLightPoints(
  features: LinearFeature[]
): GeoJSON.FeatureCollection<GeoJSON.Point, LightPointProps> {
  const out: GeoJSON.Feature<GeoJSON.Point, LightPointProps>[] = [];
  for (const feature of features) {
    const rule = LIGHT_RULES[feature.lighting_line_type];
    if (!rule) continue;
    let carry = 0;
    let index = 0;
    const coords = feature.coordinates;
    for (let i = 1; i < coords.length; i++) {
      const [lon1, lat1] = coords[i - 1]!;
      const [lon2, lat2] = coords[i]!;
      const segLen = haversineDistance(lat1, lon1, lat2, lon2);
      if (segLen <= 0) continue;
      const bearing = calculateBearing(lat1, lon1, lat2, lon2);
      for (let d = carry; d <= segLen; d += rule.spacingM) {
        let point = destinationPoint(lat1, lon1, d, bearing);
        if (rule.offsetM !== 0) {
          point = destinationPoint(point[1], point[0], rule.offsetM, bearing + 90);
        }
        out.push({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: point },
          properties: { color: rule.colors[index % rule.colors.length]!, pulse: rule.pulse },
        });
        index++;
        carry = d + rule.spacingM - segLen;
      }
    }
  }
  return { type: 'FeatureCollection', features: out };
}

/** The same lit segments as lines, for the zoom range where single fixtures would be sub-pixel. */
export function taxiwayLightLines(
  features: LinearFeature[]
): GeoJSON.FeatureCollection<GeoJSON.LineString, { color: LightColor }> {
  const out: GeoJSON.Feature<GeoJSON.LineString, { color: LightColor }>[] = [];
  for (const feature of features) {
    const rule = LIGHT_RULES[feature.lighting_line_type];
    if (!rule || feature.coordinates.length < 2) continue;
    out.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: feature.coordinates.map(([lon, lat]) => [lon, lat]),
      },
      properties: { color: rule.colors[0]! },
    });
  }
  return { type: 'FeatureCollection', features: out };
}
