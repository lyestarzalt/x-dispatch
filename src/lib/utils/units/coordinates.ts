import type { CoordinateFormat, Translate } from './types';

function hemisphere(value: number, positive: string, negative: string, t: Translate): string {
  return t(value >= 0 ? positive : negative);
}

function decimalMinutesParts(absValue: number): { deg: number; min: number; sec: number } {
  const deg = Math.floor(absValue);
  const minutesFloat = (absValue - deg) * 60;
  const min = Math.floor(minutesFloat);
  const sec = Math.round((minutesFloat - min) * 60);
  return { deg, min, sec };
}

function axis(
  value: number,
  posKey: string,
  negKey: string,
  t: Translate,
  format: CoordinateFormat
): string {
  const absValue = Math.abs(value);
  const letter = hemisphere(value, posKey, negKey, t);

  if (format === 'decimal') {
    return `${absValue.toFixed(4)}°${letter}`;
  }
  if (format === 'dms') {
    const { deg, min, sec } = decimalMinutesParts(absValue);
    return `${letter}${deg}°${min}'${sec}"`;
  }
  // 'dm' — degrees + decimal minutes
  const deg = Math.floor(absValue);
  const decimalMinutes = (absValue - deg) * 60;
  return `${letter}${deg}°${decimalMinutes.toFixed(2)}'`;
}

/** lat/lon -> localized display string in the chosen format. */
export function formatCoordinates(
  lat: number,
  lon: number,
  format: CoordinateFormat,
  t: Translate
): string {
  const latStr = axis(lat, 'directions.n', 'directions.s', t, format);
  const lonStr = axis(lon, 'directions.e', 'directions.w', t, format);
  return `${latStr} ${lonStr}`;
}
