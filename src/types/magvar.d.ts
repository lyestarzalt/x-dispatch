/**
 * The `magvar` package (WMM2025-2030 magnetic variation) ships no TypeScript
 * types. Minimal ambient declaration for the one export we use.
 */
declare module 'magvar' {
  /**
   * Magnetic variation (declination) in degrees at a position. Positive =
   * magnetic north east of true north. `altitude` in km MSL (default 0).
   * `when` is a decimal year or a Date; defaults to the current UTC time.
   */
  export function magvar(
    latitude: number,
    longitude: number,
    altitude?: number,
    when?: number | Date
  ): number;
}
