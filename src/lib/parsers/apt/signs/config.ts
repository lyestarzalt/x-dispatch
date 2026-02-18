import type { SignSize } from '@/types/apt';
import type { SignConfig, SignDimensions } from './types';

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

export const SIGN_LAYER_CONFIG = {
  minZoom: 16,
  iconSize: 0.6,
};

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
