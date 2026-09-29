import { describe, expect, it, vi } from 'vitest';
import { type AnalyticsClient, createAnalytics } from './analytics';

function setup(opts: { enabled?: boolean; installId?: string | null } = {}) {
  let installId: string | null = opts.installId === undefined ? 'install-1' : opts.installId;
  let time = 1_000_000;
  const client: AnalyticsClient = {
    capture: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
  const createClient = vi.fn(() => client);
  const analytics = createAnalytics({
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

  it('stops immediately when consent is withdrawn', async () => {
    const { analytics, client, events, setInstallId } = setup();
    analytics.startSession();
    setInstallId(null);
    analytics.onConsentChanged(false);
    analytics.trackFeature('launch');
    await analytics.shutdown();
    expect(events().map((e) => e.event)).toEqual(['app_started']);
    expect(client.shutdown).toHaveBeenCalledTimes(1);
  });

  it('reports session length on shutdown and flushes', async () => {
    const { analytics, client, events, advance } = setup();
    analytics.startSession();
    advance(125_400);
    await analytics.shutdown();
    expect(events().at(-1)).toMatchObject({
      event: 'session_ended',
      properties: { duration_seconds: 125 },
    });
    expect(client.shutdown).toHaveBeenCalledWith(3_000);
  });
});
