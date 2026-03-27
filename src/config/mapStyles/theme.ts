/**
 * Professional airport map theme with day/night cycle support
 * Uses MapLibre's light, sky, and atmosphere features
 */

/**
 * Runway light colors
 */
export const RUNWAY_LIGHT_COLORS = {
  // Approach lights
  approachWhite: '#FFFFFF',
  approachRed: '#FF0000',

  // Threshold lights
  thresholdGreen: '#00FF00',

  // End lights
  endRed: '#FF0000',

  // Edge lights
  edgeWhite: '#FFFFFF',
  edgeYellow: '#FFD700', // Last 2000ft

  // Centerline lights
  centerlineWhite: '#FFFFFF',
  centerlineRed: '#FF0000', // Last 3000ft alternating
  centerlineYellow: '#FFD700', // Last 1000ft

  // Touchdown zone
  tdzWhite: '#FFFFFF',

  // PAPI/VASI
  papiRed: '#FF0000',
  papiWhite: '#FFFFFF',
};
