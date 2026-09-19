import type { IMetar } from 'metar-taf-parser';

export type Precipitation = 'none' | 'rain' | 'snow';

export interface GroundWeather {
  /** True direction the wind blows from, null when calm or variable. */
  windFromDeg: number | null;
  windKt: number;
  precip: Precipitation;
  /** 0 clear, 1 dense fog, from prevailing visibility. */
  fog: number;
}

export const CALM: GroundWeather = { windFromDeg: null, windKt: 0, precip: 'none', fog: 0 };

const FOG_FULL_M = 800;
const FOG_NONE_M = 6000;
const SNOW_CODES = new Set(['SN', 'SG', 'IC', 'PL', 'GS']);
const RAIN_CODES = new Set(['RA', 'DZ', 'GR', 'UP']);
const FOG_CODES = new Set(['FG', 'BR', 'HZ', 'FU']);

function toKnots(speed: number, unit: string | undefined): number {
  switch (unit) {
    case 'MPS':
      return speed * 1.94384;
    case 'KM/H':
      return speed / 1.852;
    default:
      return speed;
  }
}

function visibilityMeters(metar: IMetar): number | null {
  if (metar.cavok) return 10_000;
  const vis = metar.visibility;
  if (!vis) return null;
  return String(vis.unit) === 'SM' ? vis.value * 1609.34 : vis.value;
}

/** Reduces a parsed METAR to the few numbers the ground effects need. */
export function groundWeatherFrom(metar: IMetar | null | undefined): GroundWeather {
  if (!metar) return CALM;

  const wind = metar.wind;
  const windKt = wind ? Math.round(toKnots(wind.speed, wind.unit)) : 0;
  const windFromDeg = wind && typeof wind.degrees === 'number' && windKt > 0 ? wind.degrees : null;

  let precip: Precipitation = 'none';
  let obscured = false;
  for (const condition of metar.weatherConditions ?? []) {
    for (const phenomenon of condition.phenomenons ?? []) {
      const code = String(phenomenon);
      if (SNOW_CODES.has(code)) precip = 'snow';
      else if (RAIN_CODES.has(code) && precip === 'none') precip = 'rain';
      if (FOG_CODES.has(code)) obscured = true;
    }
  }

  const visM = visibilityMeters(metar);
  let fog = 0;
  if (visM !== null && (obscured || visM < FOG_NONE_M)) {
    fog = Math.min(1, Math.max(0, (FOG_NONE_M - visM) / (FOG_NONE_M - FOG_FULL_M)));
  }

  return { windFromDeg, windKt, precip, fog };
}
