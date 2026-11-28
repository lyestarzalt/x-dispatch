import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ANALYTICS_ERROR_CODES, sanitizeEvent } from '@/lib/analytics/events';

const toastErrorSpy = vi.fn();
const trackEventSpy = vi.fn();
const log = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: (...args: unknown[]) => toastErrorSpy(...args) } }));
vi.mock('@/queries/useAnalytics', () => ({
  trackEvent: (...args: unknown[]) => trackEventSpy(...args),
}));
vi.mock('@/lib/utils/loggerRenderer', () => ({ default: { renderer: log } }));

const { toastError, errorCode } = await import('./toastError');

beforeEach(() => vi.clearAllMocks());

describe('toastError', () => {
  it('shows the toast and records the area, the action and the cause, never the message', () => {
    toastError(
      'fms_export',
      { action: 'export_fms', cause: 'download_failed' },
      'Could not write C:\\Users\\bob\\plan.fms',
      { duration: 5000 }
    );
    expect(toastErrorSpy).toHaveBeenCalledWith('Could not write C:\\Users\\bob\\plan.fms', {
      duration: 5000,
    });
    expect(trackEventSpy).toHaveBeenCalledWith('error_shown', {
      area: 'fms_export',
      action: 'export_fms',
      code: 'download_failed',
    });
    expect(JSON.stringify(trackEventSpy.mock.calls)).not.toContain('bob');
  });

  it('sends what the allowlist accepts', () => {
    toastError('companion_apps', { action: 'launch_companion_app', cause: 'NEEDS_ADMIN' }, 'x');
    const [event, props] = trackEventSpy.mock.calls[0] as [string, object];
    expect(sanitizeEvent(event, props)?.properties).toEqual({
      area: 'companion_apps',
      action: 'launch_companion_app',
      code: 'needs_admin',
    });
  });

  it('writes the message to the app log, where a support request can find it', () => {
    toastError('logs', { action: 'open_xplane_log', cause: 'no_log' }, 'No log file yet');
    expect(log.warn).toHaveBeenCalledWith(
      'Error shown (logs/open_xplane_log, no_log): No log file yet'
    );
    expect(log.error).not.toHaveBeenCalled();
  });

  it('files a thrown error whose cause it cannot name', () => {
    const thrown = new Error('EBUSY: resource busy');
    toastError('flight_plan', { action: 'save_plan', cause: thrown }, 'Could not save');
    expect(log.error).toHaveBeenCalledWith(
      'Error shown (flight_plan/save_plan, other): Could not save',
      thrown
    );
    expect(trackEventSpy).toHaveBeenCalledWith(
      'error_shown',
      expect.objectContaining({ code: 'other' })
    );
  });

  it('does not file an error that already names its cause', () => {
    const coded = Object.assign(new Error('Folder is gone'), { code: 'FOLDER_NOT_FOUND' });
    toastError('addon_manager', { action: 'scenery_delete', cause: coded }, 'Folder is gone');
    expect(log.error).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalled();
  });

  it('says so when the call site had no cause to give', () => {
    toastError('logbook', { action: 'copy_image' }, 'Could not copy');
    expect(trackEventSpy).toHaveBeenCalledWith('error_shown', {
      area: 'logbook',
      action: 'copy_image',
      code: null,
    });
    expect(log.warn).toHaveBeenCalledWith(
      'Error shown (logbook/copy_image, no cause): Could not copy'
    );
  });
});

describe('errorCode', () => {
  it('reads a code from a string, an error with a code, or an error wrapping one', () => {
    expect(errorCode('FILE_MISSING')).toBe('file_missing');
    expect(errorCode(Object.assign(new Error('x'), { code: 'PASSWORD_REQUIRED' }))).toBe(
      'password_required'
    );
    expect(errorCode({ error: { code: 'CONFLICT' } })).toBe('conflict');
  });

  it('keeps a file held open by another program apart from other add-on failures', () => {
    expect(errorCode({ code: 'FILE_IN_USE' })).toBe('file_in_use');
  });

  it('never lets free text through', () => {
    expect(errorCode('C:\\Users\\bob\\x.zip is locked')).toBe('other');
    expect(errorCode(new Error('whatever'))).toBe('other');
    expect(errorCode(42)).toBe('other');
  });

  it('is null only when there was no cause at all', () => {
    expect(errorCode(undefined)).toBeNull();
    expect(errorCode(null)).toBeNull();
  });

  it('only ever returns a listed code', () => {
    for (const code of ANALYTICS_ERROR_CODES) expect(errorCode(code.toUpperCase())).toBe(code);
  });
});
