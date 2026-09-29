import { isAnalyticsFeature } from './events';

type PropertyValue = string | number | boolean | null;
type Properties = Record<string, PropertyValue>;

export interface AnalyticsClient {
  capture(message: {
    distinctId: string;
    event: string;
    properties: Properties;
    timestamp?: Date;
  }): void;
  shutdown(timeoutMs?: number): Promise<void>;
}

/** A finished session, stored at quit and reported on the next launch. */
export interface PendingSession {
  durationSeconds: number;
  endedAt: string;
  appVersion: string;
}

export interface AnalyticsDeps {
  /** False in dev and E2E builds: nothing is ever sent. */
  enabled: boolean;
  /** Anonymous install ID, or null when consent is not granted. */
  getInstallId: () => string | null;
  createClient: () => AnalyticsClient;
  baseProperties: () => Properties;
  /** Returns and clears the session saved by the previous run. */
  takePendingSession: () => PendingSession | null;
  /** Synchronously persists the session that just ended. */
  savePendingSession: (session: PendingSession) => void;
  appVersion: () => string;
  now?: () => number;
}

const SHUTDOWN_TIMEOUT_MS = 1_000;

/**
 * Usage analytics core. Every capture re-checks consent, so withdrawing it in
 * Settings takes effect immediately without restarting. Nothing here ever
 * blocks app quit: the session length is saved to disk and sent next launch.
 */
export function createAnalytics(deps: AnalyticsDeps) {
  const now = deps.now ?? Date.now;
  let client: AnalyticsClient | null = null;
  let sessionStartedAt: number | null = null;

  function capture(event: string, properties: Properties = {}, timestamp?: Date): void {
    if (!deps.enabled) return;
    const distinctId = deps.getInstallId();
    if (!distinctId) return;
    client ??= deps.createClient();
    client.capture({
      distinctId,
      event,
      properties: {
        ...deps.baseProperties(),
        ...properties,
        // Anonymous events: no person profile is created for the install ID.
        $process_person_profile: false,
      },
      ...(timestamp && { timestamp }),
    });
  }

  function startSession(): void {
    if (sessionStartedAt !== null) return;
    if (!deps.enabled || !deps.getInstallId()) return;
    sessionStartedAt = now();
    capture('app_started');
    const previous = deps.takePendingSession();
    if (previous) {
      capture(
        'session_ended',
        { duration_seconds: previous.durationSeconds, $app_version: previous.appVersion },
        new Date(previous.endedAt)
      );
    }
  }

  function stopClient(): void {
    const stopping = client;
    client = null;
    void stopping?.shutdown(SHUTDOWN_TIMEOUT_MS).catch(() => {});
  }

  return {
    startSession,

    trackFeature(feature: unknown): void {
      if (!isAnalyticsFeature(feature)) return;
      capture('feature_opened', { feature });
    },

    /** Called after the stored consent changes. */
    onConsentChanged(granted: boolean): void {
      if (granted) {
        startSession();
        return;
      }
      sessionStartedAt = null;
      stopClient();
    },

    /** Synchronous; safe to call from `before-quit`. */
    endSession(): void {
      if (sessionStartedAt !== null && deps.getInstallId()) {
        deps.savePendingSession({
          durationSeconds: Math.round((now() - sessionStartedAt) / 1000),
          endedAt: new Date(now()).toISOString(),
          appVersion: deps.appVersion(),
        });
      }
      sessionStartedAt = null;
      // Best effort for queued events; the process may exit before it finishes.
      stopClient();
    },
  };
}

export type Analytics = ReturnType<typeof createAnalytics>;
