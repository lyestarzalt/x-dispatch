import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { Aircraft } from '@/types/aircraft';

/**
 * Drops the `livery` field entirely when the user has selected "Default" —
 * sending an empty/Default livery name caused X-Plane to silently revert to
 * the stock livery on cold launch.
 */
export function buildAircraftSection(
  aircraft: Aircraft,
  livery: string
): Pick<FlightInit, 'aircraft'> {
  return {
    aircraft: {
      path: aircraft.path,
      ...(livery !== 'Default' && { livery }),
    },
  };
}
