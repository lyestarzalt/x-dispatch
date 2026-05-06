/**
 * X-Plane arg reserved by X-Dispatch. The launcher always sets it itself, so
 * a CLI-supplied value from the user must not be allowed to override it.
 */
export const RESERVED_XP_ARG = '--new_flight_json';

export function filterReservedXpArgs(args: readonly string[]): string[] {
  return args.filter((a) => !a.trim().startsWith(RESERVED_XP_ARG));
}
