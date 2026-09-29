import { describe, expect, it, vi } from 'vitest';
import { type AnalyticsClient, type PendingSession, createAnalytics } from './analytics';

function setup(
  opts: { enabled?: boolean; installId?: string | null; pending?: PendingSession } = {}
) {
  let installId: string | null = opts.installId === undefined ? 'install-1' : opts.installId;
  let time = 1_000_000;
  const client: AnalyticsClient = {
    capture: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
  const createClient = vi.fn(() => client);
  let pending: PendingSession | null = opts.pending ?? null;
  const analytics = createAnalytics({
    takePendingSession: () => {
      const p = pending;
      pending = null;
      return p;
    },
    savePendingSession: (session) => (pending = session),
    appVersion: () => '2.2.0',
    enabled: opts.enabled ?? true,
    getInstallId: () => installId,
    createClient,
    baseProperties: () => ({ $app_version: '2.2.0', $os: 'Mac OS X' }),
    now: () => time,
  });
  return {
    analytics,
    client,
    createClient,
    setInstallId: (id: string | null) => (installId = id),
    advance: (ms: number) => (time += ms),
    pending: () => pending,
    events: () => vi.mocked(client.capture).mock.calls.map(([m]) => m),
  };
}

describe('createAnalytics', () => {
  it('sends app_started with base properties and no person profile', () => {
    const { analytics, events } = setup();
    analytics.startSession();
    expect(events()).toEqual([
      {
        distinctId: 'install-1',
        event: 'app_started',
        properties: { $app_version: '2.2.0', $os: 'Mac OS X', $process_person_profile: false },
      },
    ]);
  });

  it('sends nothing and creates no client without consent', () => {
    const { analytics, createClient } = setup({ installId: null });
    analytics.startSession();
    analytics.trackFeature('launch');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('sends nothing in dev/E2E builds even with consent', () => {
    const { analytics, createClient } = setup({ enabled: false });
    analytics.startSession();
    analytics.trackFeature('launch');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('tracks allowlisted features and drops anything else', () => {
    const { analytics, events } = setup();
    analytics.trackFeature('logbook');
    analytics.trackFeature('secret_panel');
    analytics.trackFeature({ feature: 'launch' });
    expect(events().map((e) => [e.event, e.properties.feature])).toEqual([
      ['feature_opened', 'logbook'],
    ]);
  });

  it('starts the session when consent is granted mid-run', () => {
    const { analytics, events, setInstallId } = setup({ installId: null });
    analytics.startSession();
    setInstallId('install-2');
    analytics.onConsentChanged(true);
    expect(events().map((e) => [e.event, e.distinctId])).toEqual([['app_started', 'install-2']]);
  });

  it('stops immediately when consent is withdrawn', () => {
    const { analytics, client, events, setInstallId } = setup();
    analytics.startSession();
    setInstallId(null);
    analytics.onConsentChanged(false);
    analytics.trackFeature('launch');
    analytics.endSession();
    expect(events().map((e) => e.event)).toEqual(['app_started']);
    expect(client.shutdown).toHaveBeenCalledTimes(1);
  });

  it('saves the session length at quit without sending', () => {
    const { analytics, events, advance, pending } = setup();
    analytics.startSession();
    advance(125_400);
    analytics.endSession();
    expect(events().map((e) => e.event)).toEqual(['app_started']);
    expect(pending()).toEqual({
      durationSeconds: 125,
      endedAt: new Date(1_125_400).toISOString(),
      appVersion: '2.2.0',
    });
  });

  it('reports the previous session on the next launch with its original time', () => {
    const { analytics, events, pending } = setup({
      pending: { durationSeconds: 600, endedAt: '2026-09-28T10:00:00.000Z', appVersion: '2.1.0' },
    });
    analytics.startSession();
    expect(events().at(-1)).toMatchObject({
      event: 'session_ended',
      properties: { duration_seconds: 600, $app_version: '2.1.0' },
      timestamp: new Date('2026-09-28T10:00:00.000Z'),
    });
    expect(pending()).toBeNull();
  });

  it('keeps nothing when the session ends without consent', () => {
    const { analytics, pending, setInstallId } = setup();
    analytics.startSession();
    setInstallId(null);
    analytics.endSession();
    expect(pending()).toBeNull();
  });
});
