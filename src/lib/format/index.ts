/**
 * Centralized formatting utilities
 */
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
export function formatFrequency(freq: number, decimals = 3): string {
  return freq.toFixed(decimals);
}

const LBS_TO_KG = 0.453592;
const KG_TO_LBS = 2.20462;

export function lbsToKg(lbs: number): number {
  return lbs * LBS_TO_KG;
}

export function kgToLbs(kg: number): number {
  return kg * KG_TO_LBS;
}

/**
 * Format weight in the specified unit
 * @param lbs Weight in pounds (X-Plane native unit)
 * @param unit Target unit for display
 */
export function formatWeight(lbs: number, unit: WeightUnit): string {
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
