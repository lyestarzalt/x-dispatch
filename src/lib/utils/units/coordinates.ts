import type { Degrees } from '@/types/units';
import type { CoordinateFormat, Translate } from './types';

function hemisphere(value: number, positive: string, negative: string, t: Translate): string {
  return t(value >= 0 ? positive : negative);
}

/**
 * Whole degrees and the rest in units of 1/`perDegree` degree, rounded once on
 * the total so a rest that rounds up to a full degree carries into it
 * (45.99999° at 1/6000 is 46°0.00', never 45°60.00').
 */
function splitRounded(absValue: Degrees, perDegree: number): { deg: number; rest: number } {
  const total = Math.round(absValue * perDegree);
  return { deg: Math.floor(total / perDegree), rest: total % perDegree };
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
    const { deg, rest } = splitRounded(absValue, 3600);
    return `${letter}${deg}°${Math.floor(rest / 60)}'${rest % 60}"`;
  }
  // 'dm' — degrees + decimal minutes
  const { deg, rest } = splitRounded(absValue, 6000);
  return `${letter}${deg}°${(rest / 100).toFixed(2)}'`;
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

function insAxis(value: Degrees, positive: string, negative: string, degreeDigits: number): string {
  const { deg, rest } = splitRounded(Math.abs(value), 600);
  const letter = value >= 0 || (deg === 0 && rest === 0) ? positive : negative;
  const minutes = (rest / 10).toFixed(1).padStart(4, '0');
  return `${letter}${String(deg).padStart(degreeDigits, '0')}°${minutes}'`;
}

/**
 * lat/lon as an INS keypad takes it (CIVA and the like): hemisphere first,
 * degrees padded to 2/3 digits, minutes to a tenth, `N45°59.9' E007°59.9'`.
 * Latin N/S/E/W whatever the UI language, as printed on the keypad.
 * `lat` in [-90, 90], `lon` in [-180, 180].
 */
export function formatInsCoordinates(lat: Degrees, lon: Degrees): string {
  return `${insAxis(lat, 'N', 'S', 2)} ${insAxis(lon, 'E', 'W', 3)}`;
}
