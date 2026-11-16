import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import { START_FLIGHT_FAILURE_REASONS } from '@/lib/xplaneServices/client/restClient';
import {
  type LaunchEnvironment,
  newLaunchAttemptId,
  packMatch,
  reportLaunchFailure,
  resetLaunchReports,
  startOf,
} from './launchReport';

const sentry = vi.hoisted(() => {
  const scope = {
    setFingerprint: vi.fn(),
    setTag: vi.fn(),
    setContext: vi.fn(),
  };
  return {
    scope,
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
    captureException: vi.fn(),
    captureMessage: vi.fn(),
  };
});

vi.mock('@sentry/electron/main', () => ({
  withScope: sentry.withScope,
  captureException: sentry.captureException,
  captureMessage: sentry.captureMessage,
}));

const log = vi.hoisted(() => ({ warn: vi.fn(), info: vi.fn(), error: vi.fn() }));
vi.mock('@/lib/utils/logger', () => ({ default: { launcher: log } }));

const env: LaunchEnvironment = {
  xplaneVersion: '12.4.4-b4',
  xplaneSteam: true,
  appVersion: '2.15.0',
  platform: 'darwin',
  airport: { source: 'custom', pack: 'TFFJ St Barth' },
};

const gatePayload = {
  aircraft: { path: 'Aircraft/X-Aviation/IXEG 737 Classic/B733.acf', livery: 'Lufthansa' },
  ramp_start: { airport_id: 'DAAG', ramp: 'Gate 12' },
} as unknown as FlightInit;

const analytics = { track: vi.fn() };

/** The error handed to Sentry by the last report. */
const filedError = () => sentry.captureException.mock.calls.at(-1)?.[0] as Error;
const filedContext = () =>
  sentry.scope.setContext.mock.calls.at(-1)?.[1] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  resetLaunchReports();
});

describe('startOf', () => {
  it('reads the airport and start type from a ramp start', () => {
    expect(startOf(gatePayload)).toEqual({ airport: 'DAAG', start_type: 'ramp' });
  });

  it('classifies a coordinate start as custom with no airport', () => {
    const payload = {
      aircraft: { path: 'Aircraft/A/B.acf' },
      lle_ground_start: { latitude: 32.9, longitude: 2.4, heading_true: 0 },
    } as unknown as FlightInit;
    expect(startOf(payload)).toEqual({ airport: null, start_type: 'custom' });
  });

  it('survives a payload that never arrived', () => {
    expect(startOf(undefined)).toEqual({ airport: null, start_type: 'custom' });
  });
});

describe('reportLaunchFailure: flight changes', () => {
  it.each(START_FLIGHT_FAILURE_REASONS)('files %s in Sentry and in the log', (reason) => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      { mode: 'change_flight', reason, message: 'what X-Plane said' },
      env
    );
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(sentry.scope.setTag).toHaveBeenCalledWith('launch_reason', reason);
    expect(sentry.scope.setTag).toHaveBeenCalledWith('launch_attempt', 'ab12cd34');
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('ab12cd34'));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining(reason));
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('what X-Plane said'));
  });

  it("keeps X-Plane's code, message, payload and the scenery pack with a refusal", () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      {
        mode: 'change_flight',
        reason: 'xplane_rejected',
        xplaneCode: 'missing_ramp',
        message: "Failed to parse ramp start, ramp 'Gate 12' is not recognized",
      },
      env
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      'xplane-flight-rejected',
      'missing_ramp',
    ]);
    expect(sentry.scope.setTag).toHaveBeenCalledWith('xplane_error_code', 'missing_ramp');
    expect(sentry.scope.setTag).toHaveBeenCalledWith('airport_source', 'custom');
    expect(filedContext()).toMatchObject({
      reason: 'xplane_rejected',
      xplane_error_code: 'missing_ramp',
      error_message: "Failed to parse ramp start, ramp 'Gate 12' is not recognized",
      airport_source: 'custom',
      scenery_pack: 'TFFJ St Barth',
      payload: gatePayload,
      xplane_version: '12.4.4-b4',
      app_version: '2.15.0',
    });
    // The title is the failure, not a stack frame.
    expect(filedError().name).toBe('LaunchFailure');
    expect(filedError().message).toBe('X-Plane rejected the flight: missing_ramp');
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('pack "TFFJ St Barth"'));
  });

  it('tracks a refusal with the code, airport, start type and airport source', () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      {
        mode: 'change_flight',
        reason: 'xplane_rejected',
        xplaneCode: 'missing_aircraft',
        message: 'x',
      },
      env
    );
    expect(analytics.track).toHaveBeenCalledWith('flight_rejected', {
      error_code: 'missing_aircraft',
      airport: 'DAAG',
      start_type: 'ramp',
      airport_source: 'custom',
      airport_packs: 0,
      pack_match: 'unknown',
    });
  });

  it('buckets X-Plane codes it does not know as other and truncates long messages', () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      {
        mode: 'change_flight',
        reason: 'xplane_rejected',
        xplaneCode: 'something_new',
        message: 'y'.repeat(2000),
      },
      env
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith(['xplane-flight-rejected', 'other']);
    expect(filedContext().error_message).toHaveLength(500);
    expect(filedContext().xplane_error_code).toBe('something_new');
    expect(analytics.track).toHaveBeenCalledWith(
      'flight_rejected',
      expect.objectContaining({ error_code: 'other' })
    );
  });

  it('groups HTTP errors by status and names the status in the title', () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      { mode: 'change_flight', reason: 'http_error', httpStatus: 502, message: '<html>' },
      env
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      'launch-failure',
      'change_flight',
      'http_error',
      '502',
    ]);
    expect(filedError().message).toBe('Change flight: HTTP 502');
    expect(filedContext().http_status).toBe(502);
  });

  it('files a thrown error itself, grouped by its own stack', () => {
    const cause = new TypeError('boom');
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      { mode: 'change_flight', reason: 'exception', message: 'boom', cause },
      env
    );
    expect(sentry.captureException).toHaveBeenCalledWith(cause);
    expect(sentry.scope.setFingerprint).not.toHaveBeenCalled();
  });

  it('files a retry of the same failure once, and still logs and counts each try', () => {
    const failure = {
      mode: 'change_flight',
      reason: 'xplane_rejected',
      xplaneCode: 'missing_ramp',
      message: 'x',
    } as const;
    for (let i = 0; i < 8; i++) {
      reportLaunchFailure(analytics, `try${i}`, gatePayload, failure, env);
    }
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledTimes(8);
    expect(analytics.track).toHaveBeenCalledTimes(8);
  });

  it('files the same failure again for a different gate', () => {
    const failure = {
      mode: 'change_flight',
      reason: 'xplane_rejected',
      xplaneCode: 'missing_ramp',
      message: 'x',
    } as const;
    const otherGate = {
      ...gatePayload,
      ramp_start: { airport_id: 'DAAG', ramp: 'Gate 14' },
    } as FlightInit;
    reportLaunchFailure(analytics, 'a', gatePayload, failure, env);
    reportLaunchFailure(analytics, 'b', otherGate, failure, env);
    expect(sentry.captureException).toHaveBeenCalledTimes(2);
  });
});

describe("X-Plane's scenery pack against the app's", () => {
  const custom = (pack: string) => ({ source: 'custom' as const, pack });

  it.each([
    ['the same pack', custom('TFFJ St Barth'), { winner: 'TFFJ St Barth', count: 1 }, 'same'],
    [
      'another pack first in the list',
      custom('TFFJ St Barth'),
      { winner: 'TFFJ Old', count: 2 },
      'different',
    ],
    ['every pack switched off', custom('TFFJ St Barth'), { winner: null, count: 1 }, 'different'],
    [
      'no pack at all, default airport',
      { source: 'default' as const, pack: 'Global Airports' },
      { winner: null, count: 0 },
      'same',
    ],
    [
      'a pack the app does not read',
      { source: 'default' as const, pack: 'Global Airports' },
      { winner: 'TFFJ New', count: 1 },
      'different',
    ],
  ])('%s', (_, airport, xplanePacks, expected) => {
    expect(packMatch({ ...env, airport, xplanePacks })).toBe(expected);
  });

  it('is unknown when the pack list was not read or the app does not know the airport', () => {
    expect(packMatch(env)).toBe('unknown');
    expect(
      packMatch({
        ...env,
        airport: { source: 'unknown', pack: null },
        xplanePacks: { winner: 'A', count: 1 },
      })
    ).toBe('unknown');
  });

  it("puts X-Plane's pack beside the app's in the report, the log and the event", () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      {
        mode: 'change_flight',
        reason: 'xplane_rejected',
        xplaneCode: 'missing_ramp',
        message: 'x',
      },
      { ...env, xplanePacks: { winner: 'TFFJ Old', count: 2 } }
    );
    expect(filedContext()).toMatchObject({
      scenery_pack: 'TFFJ St Barth',
      xplane_scenery_pack: 'TFFJ Old',
      scenery_packs_with_airport: 2,
      pack_match: 'different',
    });
    expect(sentry.scope.setTag).toHaveBeenCalledWith('pack_match', 'different');
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('X-Plane uses "TFFJ Old" of 2 packs')
    );
    expect(analytics.track).toHaveBeenCalledWith(
      'flight_rejected',
      expect.objectContaining({ airport_packs: 2, pack_match: 'different' })
    );
  });
});

describe('reportLaunchFailure: never in the way', () => {
  it('does not throw when Sentry or analytics do', () => {
    sentry.withScope.mockImplementationOnce(() => {
      throw new Error('sentry is down');
    });
    const throwing = {
      track: () => {
        throw new Error('analytics is down');
      },
    };
    expect(() =>
      reportLaunchFailure(
        throwing,
        'ab12cd34',
        gatePayload,
        {
          mode: 'change_flight',
          reason: 'xplane_rejected',
          xplaneCode: 'missing_ramp',
          message: 'x',
        },
        env
      )
    ).not.toThrow();
    expect(() =>
      reportLaunchFailure(
        analytics,
        'ab12cd34',
        gatePayload,
        { mode: 'change_flight', reason: 'http_error', httpStatus: 500, message: 'x' },
        env
      )
    ).not.toThrow();
  });

  it('reports a failure that came with no payload at all', () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      undefined,
      { mode: 'change_flight', reason: 'invalid_payload', message: 'not an object' },
      { ...env, airport: { source: 'unknown', pack: null } }
    );
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    expect(filedContext()).toMatchObject({ payload: null, airport_source: 'unknown' });
  });
});

describe('reportLaunchFailure: cold starts', () => {
  it.each(['already_running', 'needs_admin', 'exe_not_found', 'path_not_configured'] as const)(
    'logs %s without filing it: the reason says it all',
    (reason) => {
      reportLaunchFailure(
        analytics,
        'ab12cd34',
        gatePayload,
        { mode: 'cold_start', reason, message: 'm', portHolder: 'other' },
        env
      );
      expect(log.warn).toHaveBeenCalledWith(expect.stringContaining(reason));
      expect(sentry.captureException).not.toHaveBeenCalled();
      expect(analytics.track).not.toHaveBeenCalled();
    }
  );

  it('files a flight setup our own validation refused', () => {
    reportLaunchFailure(
      analytics,
      'ab12cd34',
      gatePayload,
      { mode: 'cold_start', reason: 'invalid_config', message: 'Provide exactly one start' },
      env
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      'launch-failure',
      'cold_start',
      'invalid_config',
    ]);
    expect(filedError().message).toBe('Launch failed: invalid_config');
  });
});

describe('newLaunchAttemptId', () => {
  it('is short, and different each time', () => {
    const a = newLaunchAttemptId();
    expect(a).toMatch(/^[0-9a-f]{8}$/);
    expect(newLaunchAttemptId()).not.toBe(a);
  });
});
