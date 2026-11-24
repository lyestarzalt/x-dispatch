import { describe, expect, it, vi } from 'vitest';
import {
  type AnalyticsClient,
  type PendingEvent,
  type PendingSession,
  createAnalytics,
} from './analytics';

function setup(
  opts: {
    enabled?: boolean;
    installId?: string | null;
    pending?: PendingSession;
    pendingEvents?: PendingEvent[];
  } = {}
) {
  let installId: string | null = opts.installId === undefined ? 'install-1' : opts.installId;
  let time = 1_000_000;
  const client: AnalyticsClient = {
    capture: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
  const createClient = vi.fn(() => client);
  let pending: PendingSession | null = opts.pending ?? null;
  let pendingEvents: PendingEvent[] = opts.pendingEvents ?? [];
  const analytics = createAnalytics({
    takePendingEvents: () => {
      const e = pendingEvents;
      pendingEvents = [];
      return e;
    },
    savePendingEvents: (events) => (pendingEvents = events),
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
    pendingEvents: () => pendingEvents,
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
    analytics.track('feature_opened', { feature: 'launch' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('sends nothing in dev/E2E builds even with consent', () => {
    const { analytics, createClient } = setup({ enabled: false });
    analytics.startSession();
    analytics.track('feature_opened', { feature: 'launch' });
    expect(createClient).not.toHaveBeenCalled();
  });

  it('tracks allowlisted features and drops anything else', () => {
    const { analytics, events } = setup();
    analytics.track('feature_opened', { feature: 'logbook' });
    analytics.track('feature_opened', { feature: 'secret_panel' });
    analytics.track({ feature: 'launch' });
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
    analytics.track('feature_opened', { feature: 'launch' });
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

  it('reports an update when the previous session ran an older version', () => {
    const { analytics, events } = setup({
      pending: { durationSeconds: 60, endedAt: '2026-09-28T10:00:00.000Z', appVersion: '2.1.0' },
    });
    analytics.startSession();
    expect(events().map((e) => e.event)).toEqual(['app_started', 'app_updated', 'session_ended']);
    expect(events()[1]).toMatchObject({ properties: { from_version: '2.1.0' } });
  });

  it('does not report an update when the version is unchanged', () => {
    const { analytics, events } = setup({
      pending: { durationSeconds: 60, endedAt: '2026-09-28T10:00:00.000Z', appVersion: '2.2.0' },
    });
    analytics.startSession();
    expect(events().map((e) => e.event)).not.toContain('app_updated');
  });

  it('keeps nothing when the session ends without consent', () => {
    const { analytics, pending, setInstallId } = setup();
    analytics.startSession();
    setInstallId(null);
    analytics.endSession();
    expect(pending()).toBeNull();
  });
});

describe('tablet access', () => {
  it('marks events that came from a tablet and leaves desktop events unmarked', () => {
    const { analytics, events } = setup();
    analytics.startSession();
    analytics.track('feature_opened', { feature: 'logbook' });
    analytics.track('feature_opened', { feature: 'logbook' }, { remote: true });
    const opened = events().filter((e) => e.event === 'feature_opened');
    expect(opened[0]?.properties.remote).toBe(false);
    expect(opened[1]?.properties.remote).toBe(true);
  });

  it('reports the peak number of tablets with the session summary', () => {
    const first = setup();
    first.analytics.startSession();
    first.analytics.recordTabletClients(1);
    first.analytics.recordTabletClients(3);
    first.analytics.recordTabletClients(0);
    first.advance(60_000);
    first.analytics.endSession();
    expect(first.pending()?.tabletClientsPeak).toBe(3);

    const next = setup({ pending: first.pending()! });
    next.analytics.startSession();
    const ended = next.events().find((e) => e.event === 'session_ended');
    expect(ended?.properties.tablet_clients).toBe(3);
  });
});

describe('events tracked while quitting', () => {
  // On quit, main's before-quit stops the client before the renderer unloads, so
  // what the renderer reports then (an open planner, an open Launch dialog) used
  // to be dropped. It is kept on disk and sent on the next launch instead.
  it('keeps an event tracked after the session ended and sends it next launch with its time', () => {
    const first = setup();
    first.analytics.startSession();
    first.analytics.endSession();
    first.advance(500);
    first.analytics.track('flight_plan_saved', {});
    expect(first.events().map((e) => e.event)).toEqual(['app_started']);
    expect(first.createClient).toHaveBeenCalledTimes(1);
    expect(first.pendingEvents()).toEqual([
      {
        event: 'flight_plan_saved',
        properties: expect.objectContaining({ $app_version: '2.2.0', remote: false }),
        timestamp: new Date(1_000_500).toISOString(),
      },
    ]);

    const next = setup({ pendingEvents: first.pendingEvents() });
    next.analytics.startSession();
    expect(next.events().at(-1)).toMatchObject({
      event: 'flight_plan_saved',
      properties: { $app_version: '2.2.0' },
      timestamp: new Date(1_000_500),
    });
    expect(next.pendingEvents()).toEqual([]);
  });

  it('keeps nothing without consent', () => {
    const { analytics, pendingEvents } = setup({ installId: null });
    analytics.startSession();
    analytics.endSession();
    analytics.track('flight_plan_saved', {});
    expect(pendingEvents()).toEqual([]);
  });

  it('keeps at most the last 20, so a stuck renderer cannot grow the file', () => {
    const { analytics, pendingEvents } = setup();
    analytics.startSession();
    analytics.endSession();
    for (let i = 0; i < 25; i++) analytics.track('flight_plan_saved', {});
    expect(pendingEvents()).toHaveLength(20);
  });
});
