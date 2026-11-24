import { isRecord } from '@/lib/utils/typeGuards';
import { startupBucket } from './buckets';

let windowShownMs: number | null = null;

/** Main-process clock (ms since the process started) when the main window first showed. */
export function recordWindowShown(ms: number | null): void {
  windowShownMs = ms;
}

/**
 * Adds the main process's time to the window to `app_ready`, next to the
 * renderer's time to the map. The renderer's clock starts at page load and,
 * since 2.16, includes the scenery check behind the loading screen, so the two
 * together tell a slow main process from a slow map.
 */
export function withStartupTiming(event: unknown, properties: unknown): unknown {
  if (event !== 'app_ready' || !isRecord(properties) || windowShownMs === null) return properties;
  return { ...properties, window: startupBucket(windowShownMs) };
}
