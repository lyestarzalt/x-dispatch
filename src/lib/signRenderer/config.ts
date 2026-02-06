import type { SignConfig, SignDimensions, SignSize } from './types';

/**
 * Sign Renderer Configuration
 *
 * Adjust `scale` to resize all signs proportionally.
 * Adjust individual values for fine-tuning.
 */
export const SIGN_CONFIG: SignConfig = {
  scale: 1.0,

  baseFontSize: 14,
  basePadding: 4,
  baseBorderWidth: 2,
  baseCharWidth: 9,

  sizeMultipliers: {
    1: 0.75, // Small taxiway sign
    2: 1.0, // Medium taxiway sign (base)
    3: 1.3, // Large taxiway sign
    4: 1.3, // Large distance-remaining sign
    5: 0.75, // Small distance-remaining sign
  },

  // Colors per X-Plane spec
  colors: {
    Y: { bg: '#FFCC00', text: '#000000', border: '#000000' }, // Direction (yellow bg)
    R: { bg: '#CC0000', text: '#FFFFFF', border: '#000000' }, // Mandatory (red bg)
    L: { bg: '#000000', text: '#FFCC00', border: '#FFCC00' }, // Location (black bg)
    B: { bg: '#000000', text: '#FFFFFF', border: '#FFFFFF' }, // Distance (black bg)
  },
};

/**
 * Sign Layer Display Settings
 * Controls when and how signs appear on the map
 */
export const SIGN_LAYER_CONFIG = {
  // Zoom level at which signs start appearing
  minZoom: 16,

  // Icon size - use zoom interpolation to keep signs proportional to airport features
  // Signs scale with zoom to maintain visual relationship with taxiways/runways
  iconSizeStops: [
    [16, 0.4], // At minzoom, smaller
    [18, 0.6], // Medium zoom
    [20, 0.8], // Closer zoom, larger
  ] as const,
};

/**
 * Get computed dimensions for a given sign size
 */
export function getSignDimensions(signSize: SignSize | number): SignDimensions {
  const mult = SIGN_CONFIG.sizeMultipliers[signSize] ?? 1.0;
  const s = SIGN_CONFIG.scale;

  const fontSize = Math.round(SIGN_CONFIG.baseFontSize * mult * s);
  const padding = Math.round(SIGN_CONFIG.basePadding * mult * s);
  const borderWidth = Math.round(SIGN_CONFIG.baseBorderWidth * s);
  const charWidth = Math.round(SIGN_CONFIG.baseCharWidth * mult * s);
  const height = fontSize + padding * 2 + borderWidth * 2;

  return { fontSize, padding, borderWidth, charWidth, height };
}
