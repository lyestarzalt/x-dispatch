import { beforeEach, describe, expect, it, vi } from 'vitest';

const toastErrorSpy = vi.fn();
const trackEventSpy = vi.fn();
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastErrorSpy(...args) } }));
vi.mock('@/queries/useAnalytics', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
}));

describe('toastError', () => {
  beforeEach(() => {
    toastErrorSpy.mockClear();
    trackEventSpy.mockClear();
  });

  it('shows the toast and records only the area', async () => {
    const { toastError } = await import('./toastError');
    toastError('fms_export', 'Could not write C:\\Users\\bob\\plan.fms', { duration: 5000 });
    expect(toastErrorSpy).toHaveBeenCalledWith('Could not write C:\\Users\\bob\\plan.fms', {
      duration: 5000,
    });
    expect(trackEventSpy).toHaveBeenCalledWith('error_shown', { area: 'fms_export' });
  });
});
