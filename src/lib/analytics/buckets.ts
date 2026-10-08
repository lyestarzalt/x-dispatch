import {
  ANALYTICS_FMS_FORMATS,
  type AnalyticsDialogTimeBucket,
  type AnalyticsFmsFormat,
  type AnalyticsScaleBucket,
  type AnalyticsStartupBucket,
  type AnalyticsWidthBucket,
} from './events';

/** Time from window load to the map being ready. */
export function startupBucket(ms: number): AnalyticsStartupBucket {
  if (ms < 2_000) return 'under_2s';
  if (ms < 5_000) return '2_5s';
  if (ms < 10_000) return '5_10s';
  return 'over_10s';
}

/** Window width in DIPs (CSS pixels). */
export function widthBucket(width: number): AnalyticsWidthBucket {
  if (width < 1280) return 'under_1280';
  if (width < 1600) return '1280_1599';
  if (width < 1920) return '1600_1919';
  if (width < 2560) return '1920_2559';
  return '2560_plus';
}

const SCALE_STEPS: readonly AnalyticsScaleBucket[] = ['1', '1.25', '1.5', '1.75', '2'];

/** Display scaling factor, e.g. 1.5 for Windows 150%. */
export function scaleBucket(factor: number): AnalyticsScaleBucket {
  const step = SCALE_STEPS.find((s) => Math.abs(Number(s) - factor) < 0.01);
  return step ?? 'other';
}

/** How long a dialog stayed open. */
export function dialogTimeBucket(ms: number): AnalyticsDialogTimeBucket {
  if (ms < 10_000) return 'under_10s';
  if (ms < 60_000) return '10_60s';
  if (ms < 300_000) return '1_5m';
  return 'over_5m';
}

/** A SimBrief download key as reported; keys outside the known list become "other". */
export function analyticsFmsFormat(key: string): AnalyticsFmsFormat {
  return (ANALYTICS_FMS_FORMATS as readonly string[]).includes(key)
    ? (key as AnalyticsFmsFormat)
    : 'other';
}
