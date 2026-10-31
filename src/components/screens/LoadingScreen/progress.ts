import type { LoadingDetail, LoadingProgress } from '@/types/xplane';

export type LoadingStepStatus = 'pending' | 'loading' | 'complete' | 'error';

export interface ProgressStep {
  id: string;
  status: LoadingStepStatus;
  detail?: LoadingDetail;
}

type Translate = (key: string, params?: Record<string, unknown>) => string;

export const STEP_WEIGHTS: Record<string, number> = {
  airports: 0.6,
  navaids: 0.1,
  waypoints: 0.1,
  airspaces: 0.1,
  airways: 0.1,
};

const ACTIVE_STEP_FLOOR = 0.08;
const ACTIVE_STEP_CEILING = 0.98;
const INCOMPLETE_PROGRESS_CEILING = 99;

export function calculateLoadingProgress(steps: ProgressStep[]): number {
  const progress = steps.reduce((acc, step) => {
    const weight = STEP_WEIGHTS[step.id] ?? 0;

    if (step.status === 'complete') return acc + weight * 100;
    if (step.status !== 'loading') return acc;

    const detailProgress = step.detail?.total
      ? Math.min(step.detail.current / step.detail.total, 1)
      : 0;

    const boundedProgress = Math.min(
      Math.max(detailProgress, ACTIVE_STEP_FLOOR),
      ACTIVE_STEP_CEILING
    );

    return acc + weight * boundedProgress * 100;
  }, 0);

  return Math.round(progress * 10) / 10;
}

export function clampDisplayedProgress(
  previous: number,
  next: number,
  allowComplete = false
): number {
  const cappedNext = allowComplete ? next : Math.min(next, INCOMPLETE_PROGRESS_CEILING);
  return Math.max(previous, cappedNext);
}

export function getLoadingMessage(progress: LoadingProgress, t: Translate): string {
  if (progress.messageKey) {
    return t(progress.messageKey, progress.messageParams);
  }

  return progress.message ?? '';
}

export function getLoadingDetailLabel(detail: LoadingDetail, t: Translate): string {
  if (detail.labelKey) {
    return t(detail.labelKey, detail.labelParams);
  }

  return detail.label ?? '';
}

export type LoadingPhase = 'verifying' | 'loading' | null;

/**
 * The badge over the progress bar. "Checking for changes" is only true while
 * the main process says it is verifying the cache; before the first event, and
 * once the data steps are done and the airport list is being fetched, the
 * neutral "Loading data" badge is the honest one.
 */
export function loadingBadgeKey(state: {
  phase: LoadingPhase;
  verifyComplete: boolean;
  awaitingAirports: boolean;
}): 'loading.verifying' | 'loading.badge' {
  if (state.awaitingAirports || state.phase !== 'verifying') return 'loading.badge';
  return 'loading.verifying';
}

/** How long to admit the screen has waited without an update, or null while that is short. */
export const STALL_HINT_AFTER_MS = 8_000;
export function stalledForSeconds(lastUpdateAt: number, now: number): number | null {
  const waited = now - lastUpdateAt;
  if (waited <= STALL_HINT_AFTER_MS) return null;
  return Math.floor(waited / 1000);
}
