/**
 * X-Plane arg reserved by X-Dispatch. The launcher always sets it itself, so
 * a CLI-supplied value from the user must not be allowed to override it.
 */
export const RESERVED_XP_ARG = '--new_flight_json';

/**
 * The web server port comes from the Flight Setup setting, so the clients and
 * X-Plane agree on it; a hand-typed value would leave X-Dispatch talking to the
 * wrong port.
 */
export const RESERVED_XP_ARGS: readonly string[] = [RESERVED_XP_ARG, '--web_server_port'];

export function filterReservedXpArgs(args: readonly string[]): string[] {
  return args.filter((a) => !RESERVED_XP_ARGS.some((reserved) => a.trim().startsWith(reserved)));
}
