/**
 * Unit-carrying number types. A `NauticalMiles` is a plain number at runtime; the brand
 * exists only for the compiler and the reader, so a signature says what it returns and a
 * value in one unit cannot be handed to a parameter that asks for another.
 *
 * A branded value is still a `number`: it can be passed anywhere a number is wanted and
 * used in arithmetic. Arithmetic gives back a plain `number`, because the compiler cannot
 * know the unit of a product or a sum; cast the result (`as Feet`) where the unit is known.
 * Return types are branded everywhere; parameters are branded only where mixing units up
 * is a real risk, so callers holding raw numbers are not forced to cast.
 */
declare const unit: unique symbol;

type Brand<Base, Label extends string> = Base & { readonly [unit]: Label };

/** An angle in degrees: a heading, bearing, course, latitude or longitude. */
export type Degrees = Brand<number, 'degrees'>;
/** An angle in radians. */
export type Radians = Brand<number, 'radians'>;
export type Meters = Brand<number, 'meters'>;
export type Feet = Brand<number, 'feet'>;
export type NauticalMiles = Brand<number, 'nauticalMiles'>;
/** Canonical speed unit. */
export type Knots = Brand<number, 'knots'>;
/** Canonical vertical-speed unit. */
export type FeetPerMinute = Brand<number, 'feetPerMinute'>;
export type MetersPerSecond = Brand<number, 'metersPerSecond'>;
/** Canonical weight unit (X-Plane's own). */
export type Pounds = Brand<number, 'pounds'>;
export type Kilograms = Brand<number, 'kilograms'>;
/** A duration, not a clock time. */
export type Minutes = Brand<number, 'minutes'>;
export type Seconds = Brand<number, 'seconds'>;
