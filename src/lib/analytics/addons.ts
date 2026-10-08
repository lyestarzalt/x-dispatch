import type { AddonType } from '@/lib/addonManager/installer/types';
import type {
  AnalyticsAddonDetectReason,
  AnalyticsAddonInstallError,
  AnalyticsAddonSource,
  AnalyticsAddonType,
} from './events';

const ADDON_TYPE_IDS: Record<AddonType, AnalyticsAddonType> = {
  Aircraft: 'aircraft',
  SceneryLibrary: 'scenery_library',
  Scenery: 'scenery',
  Navdata: 'navdata',
  Plugin: 'plugin',
  Livery: 'livery',
  LuaScript: 'lua_script',
};

/** The installer's add-on type as reported, e.g. SceneryLibrary → scenery_library. */
export function addonTypeId(type: AddonType): AnalyticsAddonType {
  return ADDON_TYPE_IDS[type];
}

/** The kind of drop, from the extension alone: the name and path are never reported. */
export function addonSource(filePath: string, folder = false): AnalyticsAddonSource {
  if (folder) return 'folder';
  const ext = filePath.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
  return ext === 'zip' || ext === '7z' || ext === 'rar' ? ext : 'other';
}

const DETECT_REASONS: Record<string, AnalyticsAddonDetectReason> = {
  NOT_ARCHIVE: 'not_archive',
  PASSWORD_REQUIRED: 'password_required',
  INVALID_PASSWORD: 'invalid_password',
  UNSUPPORTED_FORMAT: 'unsupported_format',
  EXTRACTION_FAILED: 'extraction_failed',
  PATH_TRAVERSAL: 'path_traversal',
  SIZE_EXCEEDED: 'size_exceeded',
  SUSPICIOUS_RATIO: 'suspicious_ratio',
  NOT_FOUND: 'xplane_not_set',
};

/** Why analysing a drop failed, from the installer's error code. */
export function addonDetectReason(code: string | undefined): AnalyticsAddonDetectReason {
  return (code && DETECT_REASONS[code]) || 'unknown';
}

const INSTALL_ERRORS: Record<string, AnalyticsAddonInstallError> = {
  EXTRACTION_FAILED: 'extraction_failed',
  PASSWORD_REQUIRED: 'password_required',
  INVALID_PASSWORD: 'invalid_password',
  UNSUPPORTED_FORMAT: 'unsupported_format',
  PATH_TRAVERSAL: 'path_traversal',
  DISK_SPACE: 'disk_space',
  NOT_FOUND: 'xplane_not_set',
  EACCES: 'permission_denied',
  EPERM: 'permission_denied',
  ENOSPC: 'disk_full',
  EBUSY: 'file_locked',
  ENOENT: 'not_found',
  ENAMETOOLONG: 'path_too_long',
};

/** Why an install failed, from the installer's code or the Node file system error code. */
export function addonInstallError(code: string | undefined): AnalyticsAddonInstallError {
  return (code && INSTALL_ERRORS[code]) || 'unknown';
}
