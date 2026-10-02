/**
 * Unit types for the app-wide display formatter.
 *
 * Canonical storage units never change: distance is always nautical miles,
 * altitude always feet, speed always knots, vertical speed always feet per
 * minute, weight always pounds. Only the *display* unit (settingsStore.map.units)
 * varies. See docs/superpowers/specs/2026-10-02-unit-system-design.md.
 */

type Brand<Base, Label extends string> = Base & { readonly __brand: Label };

/** Canonical speed unit. Branded so a raw number can't be passed where knots are expected. */
export type Knots = Brand<number, 'knots'>;

/** Canonical vertical-speed unit. */
export type FeetPerMinute = Brand<number, 'feetPerMinute'>;

export type DistanceUnit = 'nm' | 'km' | 'mi';
export type AltitudeUnit = 'ft' | 'm';
export type SpeedUnit = 'kts' | 'kmh' | 'mph';
export type VerticalSpeedUnit = 'fpm' | 'ms';
/** 'decimal' = decimal degrees, 'dms' = degrees/minutes/seconds, 'dm' = degrees + decimal minutes. */
export type CoordinateFormat = 'decimal' | 'dms' | 'dm';

/** Minimal i18next-compatible translate function — avoids coupling this module to react-i18next's types. */
export type Translate = (key: string) => string;
