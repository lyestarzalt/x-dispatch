/**
 * Drop any `--new_flight_json` (with or without =value) from the input.
 * --new_flight_json is reserved by X-Dispatch and always set by the launcher
 * itself; CLI-supplied values must not be allowed to override it.
 */
export function filterReservedXpArgs(args: readonly string[]): string[] {
  return args.filter((a) => !a.trim().startsWith('--new_flight_json'));
}
