/**
 * Unit-carrying number types. A `NauticalMiles` is a plain number at runtime; the label
 * exists only for the compiler and the reader, so a field or signature says what it holds.
 *
 * The label is optional, which sets what the compiler checks:
 * - a plain number or a literal is accepted anywhere a unit is asked for (`altitudeFt: 3000`),
 *   so parsed data, sim values and test fixtures need no cast;
 * - a value that already carries one unit is rejected where another is asked for: passing
 *   `Meters` to a `Feet` parameter is a compile error.
 *
 * Arithmetic gives back a plain `number`, because the compiler cannot know the unit of a sum
 * or a product, so a conversion (`m * FEET_PER_METER`) flows into a `Feet` without a cast.
 * The check therefore gets stronger as more fields and parameters are typed: label every
 * quantity where it is declared.
 */
declare const unit: unique symbol;

type Brand<Base, Label extends string> = Base & { readonly [unit]?: Label };

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
