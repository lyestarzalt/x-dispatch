import { magneticVariation } from '@/lib/magvar';
import type { Degrees } from '@/lib/utils/geomath';
import type { Translate } from './types';

export type CourseMode = 'magnetic' | 'true' | 'both';

const normalize360 = (deg: number): number => ((deg % 360) + 360) % 360;

function pad3(deg: number): string {
  return Math.round(deg).toString().padStart(3, '0');
}

/**
 * A true course + a known magnetic variation -> localized display string, in
 * the user's chosen mode. For sources that already carry their own published
 * variation (e.g. an ILS record decoded straight from earth_nav.dat) — more
 * accurate than a live WMM lookup for that specific station, and cheaper.
 * 'both' shows magnetic first (matches how pilots conventionally brief a
 * course), separated by the same middle-dot the app already uses elsewhere
 * for compound readouts (e.g. FlightPlanBuilder's "Alternate · 42.0 NM").
 */
export function formatCourseWithVariation(
  trueDeg: Degrees,
  mode: CourseMode,
  variationDeg: number,
  t: Translate
): string {
  const magnetic = normalize360(trueDeg - variationDeg);
  if (mode === 'magnetic') return `${pad3(magnetic)}°${t('units.degM')}`;
  if (mode === 'true') return `${pad3(trueDeg)}°${t('units.degT')}`;
  return `${pad3(magnetic)}°${t('units.degM')} · ${pad3(trueDeg)}°${t('units.degT')}`;
}

/** Same as `formatCourseWithVariation`, but looks up live WMM2025 variation at a position. */
export function formatCourse(
  trueDeg: Degrees,
  mode: CourseMode,
  lat: number,
  lon: number,
  t: Translate,
  date?: Date
): string {
  return formatCourseWithVariation(trueDeg, mode, magneticVariation(lat, lon, date), t);
}
