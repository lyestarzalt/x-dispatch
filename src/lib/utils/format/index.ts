/**
 * Centralized formatting utilities
 */
import { normalize360 } from '@/lib/utils/math';
import { KG_TO_LBS, LBS_TO_KG } from '@/lib/utils/units/constants';
import type { Degrees, Kilograms, Pounds } from '@/types/units';
import type { WeightUnit } from './types';

export * from './types';

/**
 * Format altitude for display with optional FL conversion
 */
export function formatTransitionAltitude(feet: number): string {
  if (feet >= 18000) {
    return `FL${Math.round(feet / 100)}`;
  }
  return `${feet.toLocaleString()}ft`;
}

/**
 * Format decimal hours to HH:MM string
 */
export function formatTime(decimalHours: number): string {
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60) % 24;
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Format time in Zulu/UTC format
 */
export function formatZulu(decimalHours: number): string {
  return `${formatTime(decimalHours)}Z`;
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | null): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format a radio frequency for display
 */
/**
 * X-Plane apt.dat 1302 country values often have an ISO-3 prefix
 * (`USA United States`, `DZA Algeria`, `GBR United Kingdom`). Some
 * entries are just the bare ISO code with no name (`VIR`, `FRA`).
 * Returns the readable name when one follows the code, otherwise the
 * code itself; returns undefined for empty/missing input.
 */
export function formatAirportCountry(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/^[A-Z]{3}\s+(.+)$/);
  return match ? match[1] : trimmed;
}

/** A heading or bearing as three digits, rounded and wrapped: 7 is `007`, 359.6 is `000`. */
export function formatHeading(deg: Degrees): string {
  return normalize360(Math.round(deg)).toString().padStart(3, '0');
}

export function formatFrequency(freq: number, decimals = 3): string {
  return freq.toFixed(decimals);
}

export function lbsToKg(lbs: Pounds): Kilograms {
  return (lbs * LBS_TO_KG) as Kilograms;
}

export function kgToLbs(kg: Kilograms): Pounds {
  return (kg * KG_TO_LBS) as Pounds;
}

/**
 * Format weight in the specified unit
 * @param lbs Weight in pounds (X-Plane native unit)
 * @param unit Target unit for display
 */
export function formatWeight(lbs: Pounds, unit: WeightUnit): string {
  if (unit === 'kg') {
    const kg = lbsToKg(lbs);
    if (kg >= 1000) {
      return `${(kg / 1000).toFixed(1)}t`;
    }
    return `${Math.round(kg)} kg`;
  }
  if (lbs >= 10000) {
    return `${(lbs / 1000).toFixed(0)}k lbs`;
  }
  if (lbs >= 1000) {
    return `${(lbs / 1000).toFixed(1)}k lbs`;
  }
  return `${Math.round(lbs)} lbs`;
}
