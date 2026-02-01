import { LineLightingType } from '@/lib/aptParser/types';

export interface LightingStyle {
  color: string;
  glowColor: string;
  radius: number;
  blur: number;
  intensity: number;
  isPulsating: boolean;
}

/**
 * Complete lighting type to style mapping for all 9 X-Plane lighting types
 * Colors match real-world airport taxiway lighting standards
 */
export const LIGHTING_STYLES: Record<number, LightingStyle> = {
  [LineLightingType.NONE]: {
    color: 'transparent',
    glowColor: 'transparent',
    radius: 0,
    blur: 0,
    intensity: 0,
    isPulsating: false,
  },
  [LineLightingType.GREEN_BIDIRECTIONAL_LIGHTS]: {
    color: '#00FF00',
    glowColor: 'rgba(0, 255, 0, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
  [LineLightingType.BLUE_OMNIDIRECTIONAL_LIGHTS]: {
    color: '#0066FF',
    glowColor: 'rgba(0, 102, 255, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
  [LineLightingType.AMBER_UNIDIRECTIONAL_LIGHTS]: {
    color: '#FFBF00',
    glowColor: 'rgba(255, 191, 0, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
  [LineLightingType.AMBER_UNIDIRECTIONAL_PULSATING_LIGHTS]: {
    color: '#FFBF00',
    glowColor: 'rgba(255, 191, 0, 0.8)',
    radius: 5,
    blur: 3,
    intensity: 1.2,
    isPulsating: true,
  },
  [LineLightingType.ALTERNATING_AMBER_GREEN_BIDIRECTIONAL_LIGHTS]: {
    color: '#BFFF00', // Yellow-green mix
    glowColor: 'rgba(191, 255, 0, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
  [LineLightingType.RED_OMNIDIRECTIONAL_LIGHTS]: {
    color: '#FF0000',
    glowColor: 'rgba(255, 0, 0, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
  [LineLightingType.GREEN_UNIDIRECTIONAL_LIGHTS]: {
    color: '#00FF00',
    glowColor: 'rgba(0, 255, 0, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
  [LineLightingType.ALTERNATING_AMBER_GREEN_UNIDIRECTIONAL_LIGHTS]: {
    color: '#BFFF00', // Yellow-green mix
    glowColor: 'rgba(191, 255, 0, 0.6)',
    radius: 4,
    blur: 2,
    intensity: 1,
    isPulsating: false,
  },
};

/**
 * Default style for unknown lighting types
 */
const DEFAULT_LIGHTING_STYLE: LightingStyle = {
  color: 'transparent',
  glowColor: 'transparent',
  radius: 0,
  blur: 0,
  intensity: 0,
  isPulsating: false,
};

/**
 * Get lighting style with fallback to default
 */
export function getLightingStyle(lightingType: number): LightingStyle {
  return LIGHTING_STYLES[lightingType] ?? DEFAULT_LIGHTING_STYLE;
}

/**
 * Check if a lighting type should be rendered
 */
export function hasVisibleLighting(lightingType: number): boolean {
  return lightingType !== LineLightingType.NONE && lightingType !== 0;
}

/**
 * Build MapLibre paint expression for lighting colors
 */
export function buildLightingColorExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lightingType']];

  for (const [type, style] of Object.entries(LIGHTING_STYLES)) {
    if (style.color !== 'transparent') {
      matchExpression.push(parseInt(type), style.color);
    }
  }

  matchExpression.push('transparent'); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}

/**
 * Build MapLibre paint expression for lighting radius
 */
export function buildLightingRadiusExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lightingType']];

  for (const [type, style] of Object.entries(LIGHTING_STYLES)) {
    matchExpression.push(parseInt(type), style.radius);
  }

  matchExpression.push(0); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}

/**
 * Build MapLibre paint expression for lighting blur
 */
export function buildLightingBlurExpression(): maplibregl.ExpressionSpecification {
  const matchExpression: unknown[] = ['match', ['get', 'lightingType']];

  for (const [type, style] of Object.entries(LIGHTING_STYLES)) {
    matchExpression.push(parseInt(type), style.blur);
  }

  matchExpression.push(0); // fallback
  return matchExpression as maplibregl.ExpressionSpecification;
}
