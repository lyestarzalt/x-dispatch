import type { Degrees, NauticalMiles } from '@/lib/utils/geomath';
import {
  type CourseMode,
  type DistanceUnit,
  type Translate,
  convertDistance,
  formatDistance,
} from '@/lib/utils/units';

const METERS_PER_NM = 1852;
const FEET_PER_NM = 6076.11549;
/** Below this many long units (NM or mi) the short unit is appended. */
const SHORT_UNIT_BELOW = 3;
/** With km as the long unit, metres replace it entirely below this. */
const METRES_ONLY_BELOW_KM = 6;

export type MeasureSnapKind = 'vor' | 'ndb' | 'dme' | 'waypoint' | 'airport';

export interface MeasureSnap {
  kind: MeasureSnapKind;
  /** Text shown on the label: ident, plus frequency for navaids. */
  label: string;
  /** The station's own published variation, when it has one. */
  magneticVariation?: number;
}

export interface MeasureGeometry {
  initialTrue: Degrees;
  finalTrue: Degrees;
  distanceNm: NauticalMiles;
  /** Variation applied at the start, east positive. */
  startVariation: number;
  /** Variation applied at the end, east positive. */
  endVariation: number;
  snap: MeasureSnap | null;
}

export interface MeasureLabelOptions {
  courseMode: CourseMode;
  distanceUnit: DistanceUnit;
  shortUnit: 'ft' | 'm';
  /** While the end follows the mouse: drop the final course so the text does not flicker. */
  placing: boolean;
  /** Label rotated 180° to stay readable: the two courses swap sides. */
  flipped: boolean;
}

const normalize360 = (deg: number): number => ((deg % 360) + 360) % 360;
const pad3 = (deg: number): string => normalize360(Math.round(deg)).toString().padStart(3, '0');

function courseLine(a: number, b: number, suffix: string, opts: MeasureLabelOptions): string {
  const first = `${pad3(a)}°${suffix}`;
  if (opts.placing || pad3(a) === pad3(b)) return first;
  const second = `${pad3(b)}°${suffix}`;
  return opts.flipped ? `${second} \\ ${first}` : `${first} \\ ${second}`;
}

function shortDistance(nm: number, unit: 'ft' | 'm', t: Translate): string {
  const value = Math.round(unit === 'ft' ? nm * FEET_PER_NM : nm * METERS_PER_NM);
  return `${value.toLocaleString()} ${t(unit === 'ft' ? 'units.ft' : 'units.m')}`;
}

function distanceText(nm: NauticalMiles, opts: MeasureLabelOptions, t: Translate): string {
  const local = convertDistance(nm, opts.distanceUnit);
  if (opts.distanceUnit === 'km') {
    return local < METRES_ONLY_BELOW_KM
      ? shortDistance(nm, 'm', t)
      : formatDistance(nm, opts.distanceUnit, t);
  }
  const long = formatDistance(nm, opts.distanceUnit, t);
  return local < SHORT_UNIT_BELOW ? `${long} / ${shortDistance(nm, opts.shortUnit, t)}` : long;
}

/**
 * Lines of the measurement label, top to bottom. Course on top in the user's
 * mode, then the snapped ident, radial and distance, then the true course
 * when both modes are shown and did not collapse into one line.
 */
export function buildMeasureLabel(
  g: MeasureGeometry,
  opts: MeasureLabelOptions,
  t: Translate
): string[] {
  const initialMag = g.initialTrue - g.startVariation;
  const finalMag = g.finalTrue - g.endVariation;
  const magSuffix = t('units.degM');
  const trueSuffix = t('units.degT');

  let magLine = '';
  let trueLine = '';
  if (
    opts.courseMode === 'both' &&
    pad3(initialMag) === pad3(g.initialTrue) &&
    pad3(finalMag) === pad3(g.finalTrue)
  ) {
    magLine = courseLine(g.initialTrue, g.finalTrue, `${magSuffix}/${trueSuffix}`, opts);
  } else {
    if (opts.courseMode !== 'true') magLine = courseLine(initialMag, finalMag, magSuffix, opts);
    if (opts.courseMode !== 'magnetic')
      trueLine = courseLine(g.initialTrue, g.finalTrue, trueSuffix, opts);
  }

  const label = g.snap?.label ?? '';
  const radial =
    g.snap && (g.snap.kind === 'vor' || g.snap.kind === 'ndb') ? `R${pad3(initialMag)}` : '';
  const dist = distanceText(g.distanceNm, opts, t);

  // A single course line always sits on top; with two, the true course closes the label.
  const lines: string[] = [magLine || trueLine];
  if (magLine && trueLine) {
    lines.push([label, radial, dist].filter(Boolean).join(' / '), trueLine);
  } else {
    lines.push([label, radial].filter(Boolean).join(' / '), dist);
  }
  return lines.filter(Boolean);
}
