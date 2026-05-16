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
