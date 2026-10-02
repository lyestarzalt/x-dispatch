import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Feet, NauticalMiles } from '@/lib/utils/geomath';
import {
  type FeetPerMinute,
  type Knots,
  type Translate,
  convertAltitude,
  convertDistance,
  convertSpeed,
  convertVerticalSpeed,
  convertWeight,
  formatAltitude,
  formatCoordinates,
  formatDistance,
  formatSpeed,
  formatVerticalSpeed,
  formatWeight,
} from '@/lib/utils/units';
import { useSettingsStore } from '@/stores/settingsStore';

type UnitPreferences = ReturnType<typeof useSettingsStore.getState>['map']['units'];

/**
 * Pure builder behind `useUnits()` — kept separate from the hook so it's
 * testable without a React renderer (this repo has no @testing-library/react
 * dependency; the hook wrapper below is thin, untested glue, same pattern as
 * other thin pass-throughs in the codebase).
 */
export function buildUnitFormatters(units: UnitPreferences, t: Translate) {
  return {
    distance: (nm: NauticalMiles) => formatDistance(nm, units.distance, t),
    altitude: (ft: Feet) => formatAltitude(ft, units.altitude, t),
    speed: (kts: Knots) => formatSpeed(kts, units.speed, t),
    verticalSpeed: (fpm: FeetPerMinute) => formatVerticalSpeed(fpm, units.verticalSpeed, t),
    weight: (lbs: number) => formatWeight(lbs, units.weight),
    coordinates: (lat: number, lon: number) => formatCoordinates(lat, lon, units.coordinates, t),
    // Raw converted numbers, for charts/axes that need a value, not a string.
    distanceF: (nm: NauticalMiles) => convertDistance(nm, units.distance),
    altitudeF: (ft: Feet) => convertAltitude(ft, units.altitude),
    speedF: (kts: Knots) => convertSpeed(kts, units.speed),
    verticalSpeedF: (fpm: FeetPerMinute) => convertVerticalSpeed(fpm, units.verticalSpeed),
    weightF: (lbs: number) => convertWeight(lbs, units.weight),
  };
}

/**
 * Bound unit formatters for the six quantities (distance, altitude, speed,
 * vertical speed, weight, coordinates), following the user's settingsStore
 * preference. Components call this instead of reading
 * `settingsStore.map.units` directly and formatting by hand — see the
 * CLAUDE.md "unit display" rule.
 */
export function useUnits() {
  const { t } = useTranslation();
  const units = useSettingsStore((s) => s.map.units);
  return useMemo(() => buildUnitFormatters(units, t), [units, t]);
}
