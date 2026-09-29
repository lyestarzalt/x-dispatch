/**
 * Allowlist shared by main and renderer. Anything not listed here is dropped
 * before it reaches PostHog, so adding an event is a deliberate, reviewed change
 * (and must be reflected on the website privacy page).
 */
export const ANALYTICS_FEATURES = [
  'launch',
  'flight_plan_builder',
  'addon_manager',
  'logbook',
  'simbrief',
  'settings',
  'weather',
] as const;

export type AnalyticsFeature = (typeof ANALYTICS_FEATURES)[number];

export function isAnalyticsFeature(value: unknown): value is AnalyticsFeature {
  return typeof value === 'string' && (ANALYTICS_FEATURES as readonly string[]).includes(value);
}

export type AnalyticsConsent = 'granted' | 'denied';

export interface AnalyticsConsentState {
  consent: AnalyticsConsent | null;
  /** True when the first-launch consent dialog should be shown. */
  shouldPrompt: boolean;
}
