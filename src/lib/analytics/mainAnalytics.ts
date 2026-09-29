import { app, net } from 'electron';
import { PostHog, type PostHogOptions } from 'posthog-node';
import logger from '../utils/logger';
import {
  getAnalyticsInstallId,
  getStoredXPlaneVersion,
  saveAnalyticsPendingSession,
  takeAnalyticsPendingSession,
} from '../xplaneServices/dataService/config';
import { type Analytics, createAnalytics } from './analytics';

// Public, write-only project key (safe to ship in client apps). EU Cloud project "X-Dispatch".
const POSTHOG_PROJECT_KEY = 'phc_tEuHKzTy9eGVsKpKHpxZoL72GaodRbfYfSVG7HVeijM4';
const POSTHOG_HOST = 'https://eu.i.posthog.com';
const REQUEST_TIMEOUT_MS = 10_000;

type PostHogFetch = NonNullable<PostHogOptions['fetch']>;

/** Routes SDK traffic through Electron's net stack with our timeout + logging contract. */
const analyticsFetch: PostHogFetch = async (url, options) => {
  const startedAt = Date.now();
  try {
    const response = await net.fetch(url, {
      method: options.method,
      headers: options.headers,
      body: options.body as BodyInit | undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.main.warn(
        `Analytics request failed in ${Date.now() - startedAt}ms: HTTP ${response.status}`
      );
    }
    return response;
  } catch (err) {
    logger.main.warn(
      `Analytics request failed in ${Date.now() - startedAt}ms: ${(err as Error).message}`
    );
    throw err;
  }
};

function osName(): string {
  if (process.platform === 'darwin') return 'Mac OS X';
  if (process.platform === 'win32') return 'Windows';
  if (process.platform === 'linux') return 'Linux';
  return process.platform;
}

export function initMainAnalytics(): Analytics {
  const enabled = app.isPackaged && !process.env.E2E_USER_DATA_DIR;
  return createAnalytics({
    enabled,
    getInstallId: getAnalyticsInstallId,
    takePendingSession: takeAnalyticsPendingSession,
    savePendingSession: saveAnalyticsPendingSession,
    appVersion: () => app.getVersion(),
    createClient: () =>
      new PostHog(POSTHOG_PROJECT_KEY, {
        host: POSTHOG_HOST,
        fetch: analyticsFetch,
        flushAt: 20,
        flushInterval: 60_000,
        requestTimeout: REQUEST_TIMEOUT_MS,
        // No server-side IP geolocation; country comes from the OS region instead.
        disableGeoip: true,
      }),
    baseProperties: () => ({
      $app_version: app.getVersion(),
      $os: osName(),
      $os_version: process.getSystemVersion(),
      arch: process.arch,
      locale: app.getLocale(),
      // Region from the OS settings (e.g. "FR"), not an IP lookup; empty when unknown.
      country: app.getLocaleCountryCode() || null,
      xplane_version: getStoredXPlaneVersion()?.version ?? null,
    }),
  });
}
