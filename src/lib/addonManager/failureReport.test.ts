import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type AddonFailure, addonFailureLevel, reportAddonFailure } from './failureReport';

const sentry = vi.hoisted(() => {
  const scope = { setFingerprint: vi.fn(), setTag: vi.fn(), setContext: vi.fn() };
  return {
    scope,
    withScope: vi.fn((fn: (s: typeof scope) => void) => fn(scope)),
    captureMessage: vi.fn(),
  };
});
vi.mock('@sentry/electron/main', () => ({
  withScope: sentry.withScope,
  captureMessage: sentry.captureMessage,
}));
const log = vi.hoisted(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }));
vi.mock('@/lib/utils/logger', () => ({ default: { addon: log } }));

beforeEach(() => vi.clearAllMocks());

const env = { platform: 'win32' as const, appVersion: '2.8.3' };

describe('addonFailureLevel', () => {
  it('treats what the user can fix as a warning and what we should fix as an error', () => {
    expect(addonFailureLevel('NOT_ARCHIVE', false)).toBe('warning');
    expect(addonFailureLevel('PASSWORD_REQUIRED', false)).toBe('warning');
    expect(addonFailureLevel('DISK_SPACE', false)).toBe('warning');
    expect(addonFailureLevel('EXTRACTION_FAILED', false)).toBe('error');
    expect(addonFailureLevel('DELETE_FAILED', false)).toBe('error');
    expect(addonFailureLevel('EACCES', false)).toBe('error');
  });

  it('downgrades a permission failure on a protected X-Plane folder to a warning', () => {
    expect(addonFailureLevel('DELETE_FAILED', true)).toBe('warning');
  });
});

describe('reportAddonFailure', () => {
  it('files one issue per action and code, tagged with what the add-on was', () => {
    const failure: AddonFailure = {
      action: 'installer.install',
      code: 'EXTRACTION_FAILED',
      reason: "ENOENT: no such file, open '/Users/gilles/Downloads/B738.zip'",
      addon: {
        addonType: 'Aircraft',
        archiveFormat: 'zip',
        archiveName: 'B738.zip',
        sizeMb: 912,
        installMode: 'fresh',
        conflictExists: false,
      },
    };
    reportAddonFailure(failure, env);

    expect(sentry.scope.setFingerprint).toHaveBeenCalledWith([
      'addon-failure',
      'installer.install',
      'EXTRACTION_FAILED',
    ]);
    expect(sentry.scope.setTag).toHaveBeenCalledWith('addon_action', 'installer.install');
    expect(sentry.scope.setTag).toHaveBeenCalledWith('addon_error_code', 'EXTRACTION_FAILED');
    expect(sentry.scope.setTag).toHaveBeenCalledWith('addon_type', 'Aircraft');
    expect(sentry.scope.setTag).toHaveBeenCalledWith('archive_format', 'zip');
    expect(sentry.scope.setContext).toHaveBeenCalledWith(
      'addon_failure',
      expect.objectContaining({
        action: 'installer.install',
        code: 'EXTRACTION_FAILED',
        reason: "ENOENT: no such file, open '/Users/<user>/Downloads/B738.zip'",
        addon_type: 'Aircraft',
        archive_format: 'zip',
        archive_name: 'B738.zip',
        size_mb: 912,
        install_mode: 'fresh',
        conflict_exists: false,
        protected_folder: false,
        platform: 'win32',
      })
    );
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      'Add-on installer.install failed: EXTRACTION_FAILED (Aircraft, zip)',
      'error'
    );
    expect(log.error).toHaveBeenCalled();
  });

  it('spots a protected X-Plane folder from the permission error and says so', () => {
    reportAddonFailure(
      {
        action: 'browser.deletePlugin',
        code: 'DELETE_FAILED',
        reason:
          "EPERM: operation not permitted, rmdir 'C:\\Program Files\\X-Plane 12\\Resources\\plugins\\X'",
        xplanePath: 'C:\\Program Files\\X-Plane 12',
      },
      env
    );
    expect(sentry.scope.setTag).toHaveBeenCalledWith('protected_folder', 'true');
    expect(sentry.scope.setContext).toHaveBeenCalledWith(
      'addon_failure',
      expect.objectContaining({ protected_folder: true, xplane_folder_kind: 'program-files' })
    );
    expect(sentry.captureMessage).toHaveBeenCalledWith(
      'Add-on browser.deletePlugin failed: DELETE_FAILED',
      'warning'
    );
    expect(log.warn).toHaveBeenCalled();
  });

  it('never sends the X-Plane path itself, only its kind', () => {
    reportAddonFailure(
      {
        action: 'scenery.saveOrder',
        code: 'WRITE_FAILED',
        reason: 'EBUSY',
        xplanePath: 'D:\\Sims\\X-Plane 12',
      },
      env
    );
    const [, context] = sentry.scope.setContext.mock.calls[0]!;
    expect(JSON.stringify(context)).not.toContain('D:\\\\Sims');
    expect(context).toMatchObject({ xplane_folder_kind: 'other-drive' });
  });
});
