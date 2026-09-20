import { sunPosition } from '@/lib/map/solar/solarPosition';

export type AirfieldLightsMode = 'auto' | 'on' | 'off';

/** Fixtures come on around sunset and reach full brightness in early dusk. */
const LIGHTS_START_ALT = 1;
const LIGHTS_FULL_ALT = -4;

/** 0 = dark fixtures, 1 = full brightness, for the given mode, instant and place. */
export function airfieldLightFactor(
  mode: AirfieldLightsMode,
  timeMs: number,
  lat: number,
  lon: number
): number {
  if (mode === 'off') return 0;
  if (mode === 'on') return 1;
  const altitude = sunPosition(timeMs, lat, lon).altitude;
  const t = (LIGHTS_START_ALT - altitude) / (LIGHTS_START_ALT - LIGHTS_FULL_ALT);
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
