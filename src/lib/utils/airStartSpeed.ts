import { METERS_PER_NM } from '@/lib/utils/units/constants';
import type { MetersPerSecond } from '@/types/units';

export type AirSpeedUnit = 'kt' | 'ms';

const METERS_PER_SECOND_PER_KNOT = METERS_PER_NM / 3600;

export function isValidAirStartSpeed(speed: number | undefined): speed is number {
  return typeof speed === 'number' && Number.isFinite(speed) && speed > 0;
}

export function airSpeedToMs(speed: number, unit: AirSpeedUnit): MetersPerSecond {
  return (unit === 'kt' ? speed * METERS_PER_SECOND_PER_KNOT : speed) as MetersPerSecond;
}

export function airSpeedFromMs(speed: number, unit: AirSpeedUnit): number {
  return unit === 'kt' ? speed / METERS_PER_SECOND_PER_KNOT : speed;
}
