import { describe, expect, it } from 'vitest';
import { addonDetectReason, addonInstallError, addonSource, addonTypeId } from './addons';
import { sanitizeEvent } from './events';

describe('addonTypeId', () => {
  it('maps every installer type to an id the allowlist accepts', () => {
    expect(addonTypeId('Aircraft')).toBe('aircraft');
    expect(addonTypeId('SceneryLibrary')).toBe('scenery_library');
    expect(addonTypeId('LuaScript')).toBe('lua_script');
    for (const type of [
      'Aircraft',
      'SceneryLibrary',
      'Scenery',
      'Navdata',
      'Plugin',
      'Livery',
      'LuaScript',
    ] as const) {
      expect(
        sanitizeEvent('addon_installed', {
          type: addonTypeId(type),
          success: true,
          error_code: null,
        })
      ).not.toBeNull();
    }
  });
});

describe('addonSource', () => {
  it('reports the archive kind from the extension only', () => {
    expect(addonSource('C:\\Downloads\\Zibo.ZIP')).toBe('zip');
    expect(addonSource('/Users/me/scenery.7z')).toBe('7z');
    expect(addonSource('/Users/me/livery.rar')).toBe('rar');
    expect(addonSource('/Users/me/setup.exe')).toBe('other');
    expect(addonSource('/Users/me/Aircraft Folder')).toBe('other');
  });

  it('reports a dropped folder as folder', () => {
    expect(addonSource('/Users/me/Aircraft Folder', true)).toBe('folder');
  });
});

describe('addonDetectReason', () => {
  it('maps installer codes to reasons and anything unknown to unknown', () => {
    expect(addonDetectReason('NOT_ARCHIVE')).toBe('not_archive');
    expect(addonDetectReason('PASSWORD_REQUIRED')).toBe('password_required');
    expect(addonDetectReason('UNSUPPORTED_FORMAT')).toBe('unsupported_format');
    expect(addonDetectReason('SIZE_EXCEEDED')).toBe('size_exceeded');
    expect(addonDetectReason('NOT_FOUND')).toBe('xplane_not_set');
    expect(addonDetectReason('SOMETHING_NEW')).toBe('unknown');
    expect(addonDetectReason(undefined)).toBe('unknown');
  });

  it('builds events the allowlist accepts', () => {
    expect(
      sanitizeEvent('addon_detected', {
        result: 'error',
        reason: addonDetectReason('EXTRACTION_FAILED'),
        source: addonSource('/a/b.rar'),
        files: 1,
      })
    ).not.toBeNull();
  });
});

describe('addonInstallError', () => {
  it('maps file system errors to a handful of causes', () => {
    expect(addonInstallError('EACCES')).toBe('permission_denied');
    expect(addonInstallError('EPERM')).toBe('permission_denied');
    expect(addonInstallError('ENOSPC')).toBe('disk_full');
    expect(addonInstallError('EBUSY')).toBe('file_locked');
    expect(addonInstallError('ENAMETOOLONG')).toBe('path_too_long');
    expect(addonInstallError('ENOENT')).toBe('not_found');
  });

  it('keeps installer codes and reports anything else as unknown', () => {
    expect(addonInstallError('EXTRACTION_FAILED')).toBe('extraction_failed');
    expect(addonInstallError('PATH_TRAVERSAL')).toBe('path_traversal');
    expect(addonInstallError('EWHATEVER')).toBe('unknown');
    expect(addonInstallError(undefined)).toBe('unknown');
  });
});
