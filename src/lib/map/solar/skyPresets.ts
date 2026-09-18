/**
 * Sky, light and hillshade appearance as a function of sun altitude.
 *
 * Keyed on altitude rather than on clock phases so the same table works at
 * every latitude and season, and blends continuously between keyframes.
 */
import type { LightSpecification, SkySpecification } from 'maplibre-gl';
import type { GeoPoint } from './solarPosition';

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

export interface SkyKeyframe {
  /** Sun altitude in degrees this keyframe applies at. */
  altitude: number;
  skyColor: string;
  horizonColor: string;
  fogColor: string;
  lightColor: string;
  lightIntensity: number;
}

/** Ascending by altitude. Colours are gamma-space hex. */
export const SKY_KEYFRAMES: readonly SkyKeyframe[] = [
  {
    altitude: -18,
    skyColor: '#04060f',
    horizonColor: '#0a1030',
    fogColor: '#090e22',
    lightColor: '#26345c',
    lightIntensity: 0.15,
  },
  {
    altitude: -12,
    skyColor: '#070b1d',
    horizonColor: '#1b2452',
    fogColor: '#141a3c',
    lightColor: '#324272',
    lightIntensity: 0.18,
  },
  {
    altitude: -6,
    skyColor: '#11193d',
    horizonColor: '#553c6e',
    fogColor: '#2d2b56',
    lightColor: '#6f5f9c',
    lightIntensity: 0.24,
  },
  {
    altitude: -2,
    skyColor: '#2d4a7c',
    horizonColor: '#e2784a',
    fogColor: '#b46a55',
    lightColor: '#ff9a5e',
    lightIntensity: 0.32,
  },
  {
    altitude: 0,
    skyColor: '#4f7fb6',
    horizonColor: '#ffb062',
    fogColor: '#e8a06d',
    lightColor: '#ffb672',
    lightIntensity: 0.38,
  },
  {
    altitude: 5,
    skyColor: '#6ea6dc',
    horizonColor: '#ffd9a2',
    fogColor: '#f6d8b7',
    lightColor: '#ffe1b3',
    lightIntensity: 0.42,
  },
  {
    altitude: 15,
    skyColor: '#7fbaf0',
    horizonColor: '#eef4ff',
    fogColor: '#dbe8f7',
    lightColor: '#fff7ea',
    lightIntensity: 0.45,
  },
  {
    altitude: 60,
    skyColor: '#88c6fc',
    horizonColor: '#ffffff',
    fogColor: '#ffffff',
    lightColor: '#ffffff',
    lightIntensity: 0.45,
  },
];

/** Below this altitude the sun no longer steers the hillshade. */
const HILLSHADE_SUN_MIN_ALTITUDE = -6;
/** MapLibre's default: light from the north-west. */
export const DEFAULT_HILLSHADE_DIRECTION = 315;
export const DEFAULT_HILLSHADE_HIGHLIGHT = '#ffffff';
/** Distance term of the light position, irrelevant for direction. */
const LIGHT_RADIAL = 1.5;

export interface HillshadeSunProps {
  'hillshade-illumination-direction': number;
  'hillshade-highlight-color': string;
}

export interface SolarAppearance {
  sky: Pick<SkySpecification, 'sky-color' | 'horizon-color' | 'fog-color'>;
  hillshade: HillshadeSunProps;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const channel = (c: number) => Math.round(c).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex([
    ca[0] + (cb[0] - ca[0]) * t,
    ca[1] + (cb[1] - ca[1]) * t,
    ca[2] + (cb[2] - ca[2]) * t,
  ]);
}

/** Keyframe blended for the given sun altitude, clamped at both ends. */
export function skyKeyframeAt(altitude: number): SkyKeyframe {
  const first = SKY_KEYFRAMES[0]!;
  const last = SKY_KEYFRAMES[SKY_KEYFRAMES.length - 1]!;
  if (altitude <= first.altitude) return { ...first, altitude };
  if (altitude >= last.altitude) return { ...last, altitude };

  let upper = 1;
  while (SKY_KEYFRAMES[upper]!.altitude < altitude) upper++;
  const a = SKY_KEYFRAMES[upper - 1]!;
  const b = SKY_KEYFRAMES[upper]!;
  const t = (altitude - a.altitude) / (b.altitude - a.altitude);

  return {
    altitude,
    skyColor: mixHex(a.skyColor, b.skyColor, t),
    horizonColor: mixHex(a.horizonColor, b.horizonColor, t),
    fogColor: mixHex(a.fogColor, b.fogColor, t),
    lightColor: mixHex(a.lightColor, b.lightColor, t),
    lightIntensity: a.lightIntensity + (b.lightIntensity - a.lightIntensity) * t,
  };
}

/**
 * Light for the globe: the sun fixed to the Earth, so dragging the globe
 * turns the planet under a stationary sun.
 *
 * MapLibre's atmosphere shader takes an anchor-"map" light as a direction
 * in the globe's own frame (x towards 90E, y towards the north pole,
 * z towards 0N 0E), negates it, and rotates it with the view. Working that
 * back: the light position is the antipode of the subsolar direction, in
 * spherical form with MapLibre's 90 degree azimuth offset folded in.
 * Verified against the computed day/night boundary from two globe positions.
 */
export function globeSunLight(
  subsolar: GeoPoint,
  keyframe: SkyKeyframe = skyKeyframeAt(90)
): LightSpecification {
  const lat = subsolar.lat * RAD;
  const lon = subsolar.lon * RAD;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  const azimuth = (Math.atan2(x, -y) * DEG + 360) % 360;
  const polar = 180 - Math.acos(Math.min(1, Math.max(-1, z))) * DEG;
  return {
    anchor: 'map',
    position: [LIGHT_RADIAL, azimuth, polar],
    color: keyframe.lightColor,
    intensity: keyframe.lightIntensity,
  };
}

/**
 * Light for the flat map: the sun as seen from the map centre, azimuth
 * clockwise from north and polar angle from the zenith, which is what
 * fill-extrusion shading expects from an anchor-"map" light.
 */
export function localSunLight(
  altitude: number,
  azimuth: number,
  keyframe: SkyKeyframe = skyKeyframeAt(altitude)
): LightSpecification {
  const polar = Math.min(180, Math.max(0, 90 - altitude));
  return {
    anchor: 'map',
    position: [LIGHT_RADIAL, azimuth, polar],
    color: keyframe.lightColor,
    intensity: keyframe.lightIntensity,
  };
}

export function solarAppearance(
  altitude: number,
  azimuth: number,
  previousHillshadeDirection: number = DEFAULT_HILLSHADE_DIRECTION
): SolarAppearance {
  const keyframe = skyKeyframeAt(altitude);
  const sunSteersHillshade = altitude > HILLSHADE_SUN_MIN_ALTITUDE;
  return {
    sky: {
      'sky-color': keyframe.skyColor,
      'horizon-color': keyframe.horizonColor,
      'fog-color': keyframe.fogColor,
    },
    hillshade: {
      'hillshade-illumination-direction': sunSteersHillshade
        ? Math.round(azimuth)
        : previousHillshadeDirection,
      'hillshade-highlight-color': sunSteersHillshade
        ? keyframe.horizonColor
        : DEFAULT_HILLSHADE_HIGHLIGHT,
    },
  };
}
