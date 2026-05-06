declare const __floatBrand: unique symbol;

/**
 * Numeric value guaranteed to render with a decimal point in JSON output.
 *
 * X-Plane's flight-init JSON parser silently rejects integer values where it
 * expects floats (lat, lon, heading, elevation, distance, etc.). Forcing every
 * such value through `float()` and typing the receiving fields as `Float`
 * makes "I forgot to wrap this number" a compile-time error.
 */
export type Float = number & { readonly [__floatBrand]: true };

export const float = (n: number): Float => (Number.isInteger(n) ? n + 0.001 : n) as Float;
