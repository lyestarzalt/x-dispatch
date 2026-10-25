import * as Sentry from '@sentry/electron/main';
import logger from '@/lib/utils/logger';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import { type FlightRejectionEnvironment, startOf } from './flightRejection';

export interface FlightConnectionDrop {
  /** What broke, as the REST client describes it: `ECONNRESET: socket hang up`. */
  reason: string;
  /** X-Plane answered again afterwards, so the flight change went through. */
  recovered: boolean;
}

/**
 * The connection to X-Plane broke while it handled a flight change. X-Plane
 * stalls its web server while it loads an aircraft, so this is expected to
 * happen and usually recovers; one Sentry issue per outcome, with the payload
 * and the sim version attached, tells us how often and on which setups. The
 * payload holds no machine-identifying data: aircraft paths are relative to
 * the X-Plane folder by construction.
 */
export function reportFlightConnectionDrop(
  payload: FlightInit,
  drop: FlightConnectionDrop,
  env: FlightRejectionEnvironment
): void {
  const outcome = drop.recovered ? 'recovered' : 'lost';
  const message = drop.recovered
    ? `Change flight: connection dropped, X-Plane came back (${drop.reason})`
    : `Change flight: connection lost (${drop.reason})`;
  if (drop.recovered) logger.launcher.warn(message);
  else logger.launcher.error(message);

  Sentry.withScope((scope) => {
    scope.setFingerprint(['xplane-change-flight-connection', outcome]);
    scope.setTag('connection_outcome', outcome);
    const { airport } = startOf(payload);
    if (airport) scope.setTag('airport', airport);
    scope.setContext('flight_connection', {
      reason: drop.reason,
      recovered: drop.recovered,
      payload,
      xplane_version: env.xplaneVersion,
      xplane_steam: env.xplaneSteam,
      app_version: env.appVersion,
      platform: env.platform,
    });
    Sentry.captureMessage(message, drop.recovered ? 'warning' : 'error');
  });
}
