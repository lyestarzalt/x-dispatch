import * as Sentry from '@sentry/electron/main';
import { scrubUserPaths } from '@/lib/sentry/scrubPaths';
import logger from '@/lib/utils/logger';
import type { AddonType, ArchiveFormat } from './installer/types';

/** What the installer knew about the archive when it failed. */
export interface AddonFailureSubject {
  addonType: AddonType;
  archiveFormat: ArchiveFormat;
  /** The archive's file name, never its folder. */
  archiveName: string;
  sizeMb: number;
  installMode?: 'fresh' | 'overwrite' | 'clean';
  conflictExists?: boolean;
}

export interface AddonFailure {
  /** The IPC channel's tail: `installer.install`, `browser.deletePlugin`, `scenery.saveOrder`. */
  action: string;
  /** Our code (EXTRACTION_FAILED, DELETE_FAILED) or the file system's (EPERM, ENOSPC). */
  code: string;
  reason?: string;
  addon?: AddonFailureSubject;
  /** Used only to classify the folder; never sent. */
  xplanePath?: string | null;
}

export interface AddonFailureEnvironment {
  platform: NodeJS.Platform;
  appVersion: string;
}

/** Failures the user can act on alone: nothing for us to fix, but worth counting. */
const USER_SIDE_CODES = new Set([
  'NOT_ARCHIVE',
  'UNSUPPORTED_FORMAT',
  'PASSWORD_REQUIRED',
  'INVALID_PASSWORD',
  'MISSING_VOLUME',
  'SIZE_EXCEEDED',
  'SUSPICIOUS_RATIO',
  'DISK_SPACE',
  'ENOSPC',
  'NOT_FOUND',
  'INVALID_INPUT',
  'PATH_TRAVERSAL',
]);

const PERMISSION_PATTERN = /\b(EPERM|EACCES)\b/;

export function addonFailureLevel(code: string, protectedFolder: boolean): 'warning' | 'error' {
  if (protectedFolder || USER_SIDE_CODES.has(code)) return 'warning';
  return 'error';
}

/** Where the X-Plane folder lives, which is what decides most permission failures. */
export function xplaneFolderKind(
  xplanePath: string | null | undefined,
  platform: NodeJS.Platform
):
  'program-files' | 'system-drive' | 'other-drive' | 'home' | 'applications' | 'other' | 'unknown' {
  if (!xplanePath) return 'unknown';
  const p = xplanePath.replace(/\//g, '\\');
  if (platform === 'win32') {
    if (/^[A-Za-z]:\\Program Files( \(x86\))?\\/i.test(p)) return 'program-files';
    if (/^[A-Za-z]:\\Users\\/i.test(p)) return 'home';
    if (/^C:\\/i.test(p)) return 'system-drive';
    if (/^[A-Za-z]:\\/.test(p)) return 'other-drive';
    return 'other';
  }
  if (xplanePath.startsWith('/Applications/')) return 'applications';
  if (/^\/(Users|home)\//.test(xplanePath)) return 'home';
  if (/^\/(Volumes|mnt|media)\//.test(xplanePath)) return 'other-drive';
  return 'other';
}

/**
 * An add-on action failed. One Sentry issue per action and code, with what the
 * add-on was and why it failed, so a failure can be understood without asking
 * the user. Nothing here names the machine or the account: paths are reduced to
 * the archive's file name and the kind of folder X-Plane lives in, and the
 * reason has home-folder names removed.
 */
export function reportAddonFailure(failure: AddonFailure, env: AddonFailureEnvironment): void {
  const reason = failure.reason ? scrubUserPaths(failure.reason) : undefined;
  const folderKind = xplaneFolderKind(failure.xplanePath, env.platform);
  const permission = PERMISSION_PATTERN.test(`${failure.code} ${reason ?? ''}`);
  const protectedFolder =
    permission && (folderKind === 'program-files' || folderKind === 'applications');
  const level = addonFailureLevel(failure.code, protectedFolder);
  const subject = failure.addon
    ? ` (${failure.addon.addonType}, ${failure.addon.archiveFormat})`
    : '';
  const message = `Add-on ${failure.action} failed: ${failure.code}${subject}`;

  // Logged as a warning either way: the Sentry message below carries the level and
  // the fingerprint. An error here would file a second, stack-grouped event.
  const line = reason ? `${message}: ${reason}` : message;
  logger.addon.warn(line);

  Sentry.withScope((scope) => {
    scope.setFingerprint(['addon-failure', failure.action, failure.code]);
    scope.setTag('addon_action', failure.action);
    scope.setTag('addon_error_code', failure.code);
    scope.setTag('protected_folder', String(protectedFolder));
    if (failure.addon) {
      scope.setTag('addon_type', failure.addon.addonType);
      scope.setTag('archive_format', failure.addon.archiveFormat);
    }
    scope.setContext('addon_failure', {
      action: failure.action,
      code: failure.code,
      reason,
      addon_type: failure.addon?.addonType,
      archive_format: failure.addon?.archiveFormat,
      archive_name: failure.addon?.archiveName,
      size_mb: failure.addon?.sizeMb,
      install_mode: failure.addon?.installMode,
      conflict_exists: failure.addon?.conflictExists,
      protected_folder: protectedFolder,
      xplane_folder_kind: folderKind,
      platform: env.platform,
      app_version: env.appVersion,
    });
    Sentry.captureMessage(message, level);
  });
}
