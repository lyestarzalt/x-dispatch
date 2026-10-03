import type { Degrees, Feet, NauticalMiles } from '@/lib/utils/geomath';
import {
  type AltitudeUnit,
  type CoordinateFormat,
  type CourseMode,
  type DistanceUnit,
  type FeetPerMinute,
  type Knots,
  type SpeedUnit,
  type Translate,
  type VerticalSpeedUnit,
  formatAltitude,
  formatCoordinates,
  formatCourse,
  formatDistance,
  formatSpeed,
  formatVerticalSpeed,
  formatWeight,
} from '@/lib/utils/units';

/** Fixed samples shown next to each unit picker, in canonical units. */
const SAMPLE = {
  distanceNm: 12.5 as NauticalMiles,
  altitudeFt: 3500 as Feet,
  speedKts: 250 as Knots,
  verticalSpeedFpm: 1500 as FeetPerMinute,
  weightLbs: 2200,
  // Paris, so the coordinate sample has both a north and an east part.
  latitude: 48.8584,
  longitude: 2.2945,
  courseTrue: 90 as Degrees,
};

export interface UnitExampleKinds {
  distance: DistanceUnit;
  altitude: AltitudeUnit;
  speed: SpeedUnit;
  verticalSpeed: VerticalSpeedUnit;
  weight: 'lbs' | 'kg';
  coordinates: CoordinateFormat;
  course: CourseMode;
}

/** The sample value for one quantity, formatted in the given unit, e.g. "12.5 NM". */
export function unitExample<K extends keyof UnitExampleKinds>(
  kind: K,
  unit: UnitExampleKinds[K],
  t: Translate
): string {
  switch (kind) {
    case 'distance':
      return formatDistance(SAMPLE.distanceNm, unit as DistanceUnit, t);
    case 'altitude':
      return formatAltitude(SAMPLE.altitudeFt, unit as AltitudeUnit, t);
    case 'speed':
      return formatSpeed(SAMPLE.speedKts, unit as SpeedUnit, t);
    case 'verticalSpeed':
      return formatVerticalSpeed(SAMPLE.verticalSpeedFpm, unit as VerticalSpeedUnit, t);
    case 'weight':
      return formatWeight(SAMPLE.weightLbs, unit as 'lbs' | 'kg');
    case 'coordinates':
      return formatCoordinates(SAMPLE.latitude, SAMPLE.longitude, unit as CoordinateFormat, t);
    case 'course':
      return formatCourse(
        SAMPLE.courseTrue,
        unit as CourseMode,
        SAMPLE.latitude,
        SAMPLE.longitude,
        t
      );
  }
  return '';
}
