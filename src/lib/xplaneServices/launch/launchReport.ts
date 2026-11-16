import * as Sentry from '@sentry/electron/main';
import { randomUUID } from 'crypto';
import logger from '@/lib/utils/logger';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import type { StartFlightFailureReason } from '@/lib/xplaneServices/client/restClient';
import type { AirportScenery } from '@/lib/xplaneServices/dataService/types';
import type { LaunchErrorCode } from './index';

/** Error codes X-Plane's flight initializer returns, per the Flight Initialization API. */
export const XPLANE_FLIGHT_ERROR_CODES = [
  'json_invalid',
  'missing_aircraft',
  'missing_livery',
  'missing_airport',
  'missing_ramp',
  'missing_runway',
] as const;

export type ColdStartFailureReason = Lowercase<LaunchErrorCode>;

/**
 * One failed launch, whichever way it was tried. Both IPC handlers hand every
 * failure to `reportLaunchFailure`, so a launch cannot fail without leaving its
 * reason in the log file and, where the reason is ours to fix, in Sentry.
 */
export type LaunchFailureReport =
  | {
      mode: 'cold_start';
      reason: ColdStartFailureReason;
      message: string;
      /** With `already_running`: who holds the web API port. */
      portHolder?: 'xplane' | 'other' | 'none';
    }
  | {
      mode: 'change_flight';
      reason: StartFlightFailureReason;
      message: string;
      /** X-Plane's `error_code`, with `xplane_rejected`. */
      xplaneCode?: string;
      httpStatus?: number;
      /** What broke the connection, with `connection_lost`. */
      connectionDropped?: string;
      /** The thrown value, with `exception`. */
      cause?: unknown;
    };

export interface LaunchEnvironment {
  xplaneVersion: string | null;
  xplaneSteam: boolean;
  appVersion: string;
  platform: NodeJS.Platform;
  /** Custom Scenery or X-Plane's own airport, and the pack, for the start airport. */
  airport: AirportScenery;
  /**
   * X-Plane's side of the same question, read from `scenery_packs.ini`: the
   * first enabled pack that declares the airport, and how many packs do. The
   * app reads the last pack instead, so the two can disagree. Absent when the
   * pack list was not looked up or could not be read.
   */
  xplanePacks?: { winner: string | null; count: number };
}

/**
 * Whether the app and X-Plane read the airport from the same place. `different`
 * is the case behind a gate the app offers and X-Plane does not know.
 */
export function packMatch(env: LaunchEnvironment): 'same' | 'different' | 'unknown' {
  const { airport, xplanePacks } = env;
  if (!xplanePacks || airport.source === 'unknown') return 'unknown';
  // No enabled pack declares it: X-Plane falls back to its own airport.
  if (xplanePacks.winner === null) return airport.source === 'default' ? 'same' : 'different';
  return airport.source === 'custom' && airport.pack === xplanePacks.winner ? 'same' : 'different';
}

interface LaunchAnalytics {
  track: (event: 'flight_rejected', properties: Record<string, unknown>) => void;
}

/**
 * Which failures are filed in Sentry. A `Record` over every reason, so adding a
 * reason does not compile until someone decides. Left out: states of the
 * user's machine that the reason already explains in full, and spawn errors,
 * which the launcher files itself with the errno attached.
 */
const FILED_COLD_START: Record<ColdStartFailureReason, boolean> = {
  already_running: false,
  path_not_configured: false,
  invalid_config: true,
  exe_not_found: false,
  needs_admin: false,
  access_blocked: false,
  spawn_failed: false,
};
const FILED_CHANGE_FLIGHT: Record<StartFlightFailureReason, boolean> = {
  invalid_payload: true,
  connection_lost: true,
  http_error: true,
  invalid_response: true,
  xplane_rejected: true,
  exception: true,
};

const MESSAGE_MAX_CHARS = 500;

/** Named so the Sentry issue title reads as the failure, not as a stack frame. */
class LaunchFailure extends Error {
  override name = 'LaunchFailure';
}

/** A short id that ties a launch's log lines to its Sentry event. */
export function newLaunchAttemptId(): string {
  return randomUUID().slice(0, 8);
}

/** The two facts analytics keeps about a refused payload. */
export function startOf(payload: FlightInit | undefined): {
  airport: string | null;
  start_type: 'runway' | 'ramp' | 'custom';
} {
  if (payload?.runway_start) {
    return { airport: payload.runway_start.airport_id ?? null, start_type: 'runway' };
  }
  if (payload?.ramp_start) {
    return { airport: payload.ramp_start.airport_id ?? null, start_type: 'ramp' };
  }
  return { airport: null, start_type: 'custom' };
}

/** The X-Plane code as analytics and Sentry group it: unknown ones share a bucket. */
function knownXPlaneCode(code: string | undefined): string {
  return (XPLANE_FLIGHT_ERROR_CODES as readonly string[]).includes(code ?? '')
    ? (code as string)
    : 'other';
}

function title(failure: LaunchFailureReport): string {
  if (failure.mode === 'cold_start') return `Launch failed: ${failure.reason}`;
  switch (failure.reason) {
    case 'xplane_rejected':
      return `X-Plane rejected the flight: ${knownXPlaneCode(failure.xplaneCode)}`;
    case 'connection_lost':
      return 'Change flight: connection lost';
    case 'http_error':
      return `Change flight: HTTP ${failure.httpStatus ?? 'error'}`;
    case 'invalid_response':
      return 'Change flight: unreadable response';
    case 'invalid_payload':
      return 'Change flight: flight setup failed validation';
    case 'exception':
      return 'Change flight: exception';
  }
}

/** Kept from the earlier reporters where one existed, so the Sentry issues carry on. */
function fingerprint(failure: LaunchFailureReport): string[] {
  if (failure.mode === 'change_flight' && failure.reason === 'xplane_rejected') {
    return ['xplane-flight-rejected', knownXPlaneCode(failure.xplaneCode)];
  }
  if (failure.mode === 'change_flight' && failure.reason === 'connection_lost') {
    return ['xplane-change-flight-connection', 'lost'];
  }
  if (failure.mode === 'change_flight' && failure.reason === 'http_error') {
    return ['launch-failure', failure.mode, failure.reason, String(failure.httpStatus ?? '')];
  }
  return ['launch-failure', failure.mode, failure.reason];
}

/** Same reason on the same start: a retry, not news. */
function retryKey(failure: LaunchFailureReport, payload: FlightInit | undefined): string {
  const detail =
    failure.mode === 'change_flight' ? (failure.xplaneCode ?? failure.httpStatus ?? '') : '';
  const start = payload?.ramp_start ?? payload?.runway_start ?? null;
  return [failure.mode, failure.reason, detail, JSON.stringify(start)].join('|');
}

const filedThisSession = new Set<string>();

/** Test hook: forget which failures this session already filed. */
export function resetLaunchReports(): void {
  filedThisSession.clear();
}

/**
 * Records one failed launch. Always a log line with the attempt id; a
 * `flight_rejected` event when X-Plane refused the flight; one Sentry event per
 * session for each distinct failure we can act on, with X-Plane's message and
 * the exact payload attached. The payload holds no machine-identifying data:
 * aircraft paths are relative to the X-Plane folder by construction. Sentry and
 * analytics are no-ops when the user declined them.
 */
export function reportLaunchFailure(
  analytics: LaunchAnalytics,
  attemptId: string,
  payload: FlightInit | undefined,
  failure: LaunchFailureReport,
  env: LaunchEnvironment
): void {
  // The caller still has a failure to hand back to the user: reporting it must
  // never be what throws.
  try {
    report(analytics, attemptId, payload, failure, env);
  } catch (err) {
    logger.launcher.warn(`Could not report failed launch attempt ${attemptId}`, err);
  }
}

function report(
  analytics: LaunchAnalytics,
  attemptId: string,
  payload: FlightInit | undefined,
  failure: LaunchFailureReport,
  env: LaunchEnvironment
): void {
  const message = failure.message.slice(0, MESSAGE_MAX_CHARS);
  const start = startOf(payload);
  const change = failure.mode === 'change_flight' ? failure : null;

  logger.launcher.warn(
    `Launch attempt ${attemptId} failed (${failure.mode}, ${failure.reason}): ${message}` +
      ` [airport ${start.airport ?? 'none'}: ${env.airport.source}` +
      `${env.airport.pack ? `, pack "${env.airport.pack}"` : ''}` +
      `${env.xplanePacks ? `, X-Plane uses "${env.xplanePacks.winner ?? 'its own airport'}" of ${env.xplanePacks.count} packs` : ''}]`
  );

  if (change?.reason === 'xplane_rejected') {
    analytics.track('flight_rejected', {
      error_code: knownXPlaneCode(change.xplaneCode),
      ...start,
      airport_source: env.airport.source,
      airport_packs: Math.min(env.xplanePacks?.count ?? 0, 1000),
      pack_match: packMatch(env),
    });
  }

  const filed =
    failure.mode === 'cold_start'
      ? FILED_COLD_START[failure.reason]
      : FILED_CHANGE_FLIGHT[failure.reason];
  if (!filed) return;

  const key = retryKey(failure, payload);
  if (filedThisSession.has(key)) return;
  filedThisSession.add(key);

  Sentry.withScope((scope) => {
    scope.setTag('launch_mode', failure.mode);
    scope.setTag('launch_reason', failure.reason);
    scope.setTag('launch_attempt', attemptId);
    if (start.airport) scope.setTag('airport', start.airport);
    scope.setTag('airport_source', env.airport.source);
    scope.setTag('pack_match', packMatch(env));
    if (change?.reason === 'xplane_rejected') {
      scope.setTag('xplane_error_code', knownXPlaneCode(change.xplaneCode));
    }
    scope.setContext('launch_failure', {
      mode: failure.mode,
      reason: failure.reason,
      attempt: attemptId,
      error_message: message,
      xplane_error_code: change?.xplaneCode ?? null,
      http_status: change?.httpStatus ?? null,
      connection_dropped: change?.connectionDropped ?? null,
      port_holder: failure.mode === 'cold_start' ? (failure.portHolder ?? null) : null,
      airport_source: env.airport.source,
      scenery_pack: env.airport.pack,
      xplane_scenery_pack: env.xplanePacks?.winner ?? null,
      scenery_packs_with_airport: env.xplanePacks?.count ?? null,
      pack_match: packMatch(env),
      payload: payload ?? null,
      xplane_version: env.xplaneVersion,
      xplane_steam: env.xplaneSteam,
      app_version: env.appVersion,
      platform: env.platform,
    });

    // A thrown error groups by its own stack; everything else by its reason.
    if (change?.cause instanceof Error) {
      Sentry.captureException(change.cause);
      return;
    }
    scope.setFingerprint(fingerprint(failure));
    Sentry.captureException(new LaunchFailure(title(failure)));
  });
}
