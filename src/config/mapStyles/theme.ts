/**
 * Professional airport map theme with day/night cycle support
 * Uses MapLibre's light, sky, and atmosphere features
 */

interface TimeOfDay {
  hour: number; // 0-23
  isNight: boolean;
  lightIntensity: number;
  skyColor: string;
  horizonColor: string;
  fogColor: string;
  ambientLight: number;
}

/**
 * Calculate time of day settings based on hour
 */
function getTimeOfDay(hour: number): TimeOfDay {
  const isNight = hour < 6 || hour >= 20;
  const isDusk = hour >= 18 && hour < 20;
  const isDawn = hour >= 5 && hour < 7;

  if (isNight) {
    return {
      hour,
      isNight: true,
      lightIntensity: 0.1,
      skyColor: '#0a1628',
      horizonColor: '#1a2a4a',
      fogColor: '#0a1628',
      ambientLight: 0.2,
    };
  } else if (isDusk || isDawn) {
    return {
      hour,
      isNight: false,
      lightIntensity: 0.4,
      skyColor: '#ff7e47',
      horizonColor: '#ffb347',
      fogColor: '#ffd1a3',
      ambientLight: 0.5,
    };
  } else {
    return {
      hour,
      isNight: false,
      lightIntensity: 0.8,
      skyColor: '#88C6FC',
      horizonColor: '#ffffff',
      fogColor: '#e8f4ff',
      ambientLight: 0.8,
    };
  }
}

/**
 * MapLibre light configuration for 3D effects
 */
function getLightConfig(time: TimeOfDay): maplibregl.LightSpecification {
  return {
    anchor: 'map',
    position: [1.5, time.isNight ? 180 : 210, time.isNight ? 60 : 30],
    color: time.isNight ? '#4a6fa5' : '#ffffff',
    intensity: time.lightIntensity,
  };
}

/**
 * MapLibre sky configuration for atmosphere
 */
function getSkyConfig(time: TimeOfDay): maplibregl.SkySpecification {
  return {
    'sky-color': time.skyColor,
    'sky-horizon-blend': 0.5,
    'horizon-color': time.horizonColor,
    'horizon-fog-blend': 0.5,
    'fog-color': time.fogColor,
    'fog-ground-blend': 0.3,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 10, 0.8, 14, 0],
  };
}

/**
 * Airport feature colors based on time of day
 */
function getFeatureColors(time: TimeOfDay) {
  return {
    // Runway colors
    runwayFill: time.isNight ? '#1a1a1a' : '#2a2a2a',
    runwayCenterline: '#FFFFFF',
    runwayEdgeLights: time.isNight ? '#FFFFFF' : '#888888',
    runwayThreshold: '#00FF00',
    runwayEndLights: '#FF0000',

    // Taxiway colors
    taxiwayFill: time.isNight ? '#2a2a2a' : '#3a3a3a',
    taxiwayCenterline: '#FFD700',
    taxiwayEdgeLights: time.isNight ? '#0066FF' : '#444444',

    // Lighting glow intensity
    lightGlowIntensity: time.isNight ? 1.0 : 0.2,
    lightGlowRadius: time.isNight ? 8 : 3,

    // Sign colors
    signBackground: '#000000',
    signTextYellow: '#FFD700',
    signTextWhite: '#FFFFFF',
    signTextRed: '#FF0000',

    // General
    buildingFill: time.isNight ? '#1a2a3a' : '#4a5a6a',
    waterColor: time.isNight ? '#0a1a2a' : '#1e5799',
  };
}

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

/**
 * Taxiway light colors
 */
const TAXIWAY_LIGHT_COLORS = {
  centerlineGreen: '#00FF00',
  edgeBlue: '#0066FF',
  holdLineAmber: '#FFBF00',
  holdLinePulsating: '#FFBF00',
  stopBarRed: '#FF0000',
  leadOffGreen: '#00FF00',
};
