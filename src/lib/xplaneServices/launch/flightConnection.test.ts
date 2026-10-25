import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FlightInit } from '@/lib/xplaneServices/client/generated/xplaneApi';
import { reportFlightConnectionDrop } from './flightConnection';

const sentry = vi.hoisted(() => {
  const scope = { setFingerprint: vi.fn(), setTag: vi.fn(), setContext: vi.fn() };
  return {
    scope,
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
    captureMessage: vi.fn(),
  };
});

vi.mock('@sentry/electron/main', () => ({
  withScope: sentry.withScope,
  captureMessage: sentry.captureMessage,
}));

const log = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock('@/lib/utils/logger', () => ({ default: { launcher: log } }));

const env = {
  xplaneVersion: '12.4.4',
  xplaneSteam: false,
  appVersion: '2.8.3',
  platform: 'win32' as const,
};
const payload: FlightInit = {
  aircraft: { path: 'Aircraft/B737-800X/b738.acf' },
  ramp_start: { airport_id: 'LFLS', ramp: 'Gate 9' },
};

beforeEach(() => vi.clearAllMocks());

describe('reportFlightConnectionDrop', () => {
  it('files a warning, grouped as recovered, when X-Plane came back', () => {
    reportFlightConnectionDrop(
      payload,
      { reason: 'ECONNRESET: socket hang up', recovered: true },
      env
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      'xplane-change-flight-connection',
      'recovered',
    ]);
    expect(sentry.scope.setTag).toHaveBeenCalledWith('airport', 'LFLS');
    expect(sentry.scope.setContext).toHaveBeenCalledWith(
      'flight_connection',
      expect.objectContaining({
        reason: 'ECONNRESET: socket hang up',
        recovered: true,
        payload,
        xplane_version: '12.4.4',
      })
    );
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      'Change flight: connection dropped, X-Plane came back (ECONNRESET: socket hang up)',
      'warning'
    );
    expect(log.warn).toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it('files an error, grouped as lost, when X-Plane stayed silent', () => {
    reportFlightConnectionDrop(
      payload,
      { reason: 'no answer within 15000 ms', recovered: false },
      env
    );
    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      'xplane-change-flight-connection',
      'lost',
    ]);
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      'Change flight: connection lost (no answer within 15000 ms)',
      'error'
    );
    expect(log.error).toHaveBeenCalled();
  });
});
