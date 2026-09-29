import { isAnalyticsFeature } from './events';

type PropertyValue = string | number | boolean | null;
type Properties = Record<string, PropertyValue>;

export interface AnalyticsClient {
  capture(message: { distinctId: string; event: string; properties: Properties }): void;
  shutdown(timeoutMs?: number): Promise<void>;
}

export interface AnalyticsDeps {
  /** False in dev and E2E builds: nothing is ever sent. */
  enabled: boolean;
  /** Anonymous install ID, or null when consent is not granted. */
  getInstallId: () => string | null;
  createClient: () => AnalyticsClient;
  baseProperties: () => Properties;
  now?: () => number;
}

const SHUTDOWN_TIMEOUT_MS = 3_000;

/**
 * Usage analytics core. Every capture re-checks consent, so withdrawing it in
 * Settings takes effect immediately without restarting.
 */
export function createAnalytics(deps: AnalyticsDeps) {
  const now = deps.now ?? Date.now;
  let client: AnalyticsClient | null = null;
  let sessionStartedAt: number | null = null;

  function capture(event: string, properties: Properties = {}): void {
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
    });
  }

  function startSession(): void {
    if (sessionStartedAt !== null) return;
    if (!deps.enabled || !deps.getInstallId()) return;
    sessionStartedAt = now();
    capture('app_started');
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
      const stopping = client;
      client = null;
      void stopping?.shutdown(SHUTDOWN_TIMEOUT_MS);
    },

    async shutdown(): Promise<void> {
      if (sessionStartedAt !== null) {
        capture('session_ended', {
          duration_seconds: Math.round((now() - sessionStartedAt) / 1000),
        });
        sessionStartedAt = null;
      }
      await client?.shutdown(SHUTDOWN_TIMEOUT_MS);
      client = null;
    },
  };
}

export type Analytics = ReturnType<typeof createAnalytics>;
