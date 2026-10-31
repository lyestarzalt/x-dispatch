/**
 * Addon types in detection priority order (lower = higher priority)
 */
export type AddonType =
  'Aircraft' | 'SceneryLibrary' | 'Scenery' | 'Navdata' | 'Plugin' | 'Livery' | 'LuaScript';

export const ADDON_TYPE_PRIORITY: Record<AddonType, number> = {
  Aircraft: 0,
  SceneryLibrary: 1,
  Scenery: 2,
  Navdata: 3,
  Plugin: 4,
  Livery: 5,
  LuaScript: 6,
};

/**
 * Archive formats supported. `folder` is a dropped directory, read in place.
 */
export type ArchiveFormat = 'zip' | '7z' | 'rar' | 'folder';

/** An archive found inside another archive; the chain runs outer to inner. */
export interface NestedArchiveStep {
  /** Entry path inside the enclosing archive, e.g. `Aircraft/A330.7z`. */
  entryPath: string;
}

/** Something the user should know about an item before installing it. */
export interface InstallerWarning {
  code:
    | 'LARGE_ADDON'
    | 'FLYWITHLUA_MISSING'
    | 'AIRCRAFT_NOT_FOUND'
    | 'UNKNOWN_NAVDATA_PROVIDER'
    | 'NESTED_ARCHIVE'
    | 'MISSING_LIBRARIES';
  params?: Record<string, string | number>;
}

/**
 * Entry from archive listing (no extraction needed)
 */
export interface ArchiveEntry {
  path: string;
  isDirectory: boolean;
  uncompressedSize: number;
  compressedSize: number;
  crc32?: number; // ZIP only
  encrypted: boolean;
}

/**
 * Marker file found during scanning
 */
export interface MarkerFile {
  path: string;
  type: AddonType;
  encrypted: boolean;
}

/**
 * Result of scanning an archive
 */
export interface DetectedItem {
  id: string;
  addonType: AddonType;
  displayName: string;
  /** The dropped file or folder. With `extractionChain`, the outermost archive. */
  sourcePath: string;
  /** Format of the archive that holds the add-on (the innermost one when nested). */
  archiveFormat: ArchiveFormat;
  /** Format of what was dropped: the outer archive, or `folder`. */
  sourceFormat?: ArchiveFormat;
  archiveInternalRoot?: string;
  /** Archives to open, outer to inner, before `archiveInternalRoot` applies. */
  extractionChain?: NestedArchiveStep[];
  /** The marker file the type was read from, relative to the archive root. */
  markerPath?: string;
  /** Password the archive was opened with; carried to the install, never persisted. */
  password?: string;
  estimatedSize: number;
  versionInfo?: VersionInfo;
  liveryInfo?: DetectedLiveryInfo;
  navdataInfo?: NavdataInfo;
  warnings: InstallerWarning[];
}

export interface VersionInfo {
  version: string;
  source: string;
}

export interface DetectedLiveryInfo {
  aircraftTypeId: string;
  aircraftName: string;
}

export interface NavdataInfo {
  name: string;
  cycle: string;
  revision?: string;
}

/**
 * Prepared for installation
 */
export interface InstallTask extends DetectedItem {
  targetPath: string;
  conflictExists: boolean;
  installMode: 'fresh' | 'overwrite' | 'clean';
  backupOptions: BackupOptions;
  sizeConfirmed: boolean;
  /** What is installed at `targetPath` now, when something is. */
  existingVersion?: string;
  existingNavdata?: NavdataInfo;
}

export interface BackupOptions {
  liveries: boolean;
  configFiles: boolean;
  configPatterns: string[];
  navdata: boolean;
}

/**
 * Progress updates sent via IPC
 */
export interface InstallProgress {
  phase: 'analyzing' | 'extracting' | 'verifying' | 'finalizing';
  overallPercent: number;
  currentTaskIndex: number;
  totalTasks: number;
  currentTaskName: string;
  currentFile?: string;
  bytesProcessed: number;
  bytesTotal: number;
}

/**
 * Result of installation
 */
export interface InstallResult {
  taskId: string;
  success: boolean;
  /** Where a clean install put the previous liveries, settings or navdata. */
  backupPath?: string;
  error?: string;
  /** On failure: the installer's error code, or the file system's (EACCES, ENOSPC, ...). */
  errorCode?: string;
  verificationStats?: VerificationStats;
}

export interface VerificationStats {
  totalFiles: number;
  verifiedFiles: number;
  failedFiles: number;
  skippedFiles: number;
}

/**
 * Error types for installer operations
 */
export type InstallerError =
  | { code: 'NOT_ARCHIVE'; path: string; folder: boolean }
  | { code: 'UNSUPPORTED_FORMAT'; path: string }
  | { code: 'PASSWORD_REQUIRED'; path: string }
  | { code: 'INVALID_PASSWORD'; path: string }
  | { code: 'EXTRACTION_FAILED'; path: string; reason: string }
  | { code: 'MISSING_VOLUME'; path: string; missing: string }
  | { code: 'PATH_TRAVERSAL'; path: string }
  | { code: 'SIZE_EXCEEDED'; size: number; limit: number }
  | { code: 'SUSPICIOUS_RATIO'; ratio: number; limit: number }
  | { code: 'DISK_SPACE'; required: number; available: number }
  | { code: 'INSTALL_FAILED'; path: string; reason: string };

/**
 * Constants
 */
export const INSTALLER_CONSTANTS = {
  MAX_EXTRACTION_SIZE: 20 * 1024 * 1024 * 1024, // 20 GB
  MAX_COMPRESSION_RATIO: 100,
  /** Archive in archive in add-on: two openings at most. */
  NESTED_ARCHIVE_MAX_DEPTH: 2,
  /** Nested archives looked into per archive; a docs folder full of zips is not an add-on. */
  NESTED_ARCHIVE_MAX_COUNT: 6,
  /** Folder drops are walked this deep. */
  FOLDER_SCAN_MAX_DEPTH: 15,
  LARGE_ADDON_BYTES: 5 * 1024 * 1024 * 1024,
  /** Progress events are IPC messages; a 20,000-file scenery must not send 20,000 of them. */
  PROGRESS_THROTTLE_MS: 50,
  MIN_FREE_SPACE: 1024 * 1024 * 1024, // 1 GB
} as const;

/**
 * Files/folders to ignore during extraction
 */
export const IGNORE_PATTERNS = ['__MACOSX', '.DS_Store', 'Thumbs.db', 'desktop.ini', '.git'];

/**
 * Platform folders for plugin detection
 */
export const PLATFORM_FOLDERS = ['32', '64', 'win', 'lin', 'mac', 'win_x64', 'mac_x64', 'lin_x64'];

/**
 * Get user-friendly error message from InstallerError.
 */
export function getInstallerErrorMessage(error: InstallerError): string {
  switch (error.code) {
    case 'NOT_ARCHIVE':
      return `Not a .zip, .7z or .rar archive, or a folder: ${error.path}`;
    case 'UNSUPPORTED_FORMAT':
      return `Unsupported archive format: ${error.path}`;
    case 'PASSWORD_REQUIRED':
      return `Password required for: ${error.path}`;
    case 'INVALID_PASSWORD':
      return `Invalid password for: ${error.path}`;
    case 'EXTRACTION_FAILED':
      return `Extraction failed: ${error.reason}`;
    case 'MISSING_VOLUME':
      return `Missing part of a split archive: ${error.missing}`;
    case 'PATH_TRAVERSAL':
      return `Invalid path detected: ${error.path}`;
    case 'SIZE_EXCEEDED':
      return `Archive too large: ${(error.size / 1024 / 1024 / 1024).toFixed(1)} GB exceeds ${(error.limit / 1024 / 1024 / 1024).toFixed(1)} GB limit`;
    case 'SUSPICIOUS_RATIO':
      return `Suspicious compression ratio: ${error.ratio.toFixed(0)}x exceeds ${error.limit}x limit`;
    case 'DISK_SPACE':
      return `Insufficient disk space: need ${(error.required / 1024 / 1024 / 1024).toFixed(1)} GB, have ${(error.available / 1024 / 1024 / 1024).toFixed(1)} GB`;
    case 'INSTALL_FAILED':
      return `Installation failed: ${error.reason}`;
    default:
      // Handle any unexpected error codes (e.g., from IPC layer)
      return `Installation error: ${(error as { code: string }).code}`;
  }
}
