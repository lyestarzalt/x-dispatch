/**
 * Addon types in detection priority order (lower = higher priority)
 */
export type AddonType =
  | 'Aircraft'
  | 'SceneryLibrary'
  | 'Scenery'
  | 'Navdata'
  | 'Plugin'
  | 'Livery'
  | 'LuaScript';

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
 * Archive formats supported
 */
export type ArchiveFormat = 'zip' | '7z' | 'rar';

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
  sourcePath: string;
  archiveFormat: ArchiveFormat;
  archiveInternalRoot?: string;
  estimatedSize: number;
  versionInfo?: VersionInfo;
  liveryInfo?: DetectedLiveryInfo;
  navdataInfo?: NavdataInfo;
  warnings: string[];
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
  error?: string;
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
  | { code: 'UNSUPPORTED_FORMAT'; path: string }
  | { code: 'PASSWORD_REQUIRED'; path: string }
  | { code: 'INVALID_PASSWORD'; path: string }
  | { code: 'EXTRACTION_FAILED'; path: string; reason: string }
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
  NESTED_ARCHIVE_MAX_DEPTH: 2,
  PROGRESS_THROTTLE_MS: 16,
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
    case 'UNSUPPORTED_FORMAT':
      return `Unsupported archive format: ${error.path}`;
    case 'PASSWORD_REQUIRED':
      return `Password required for: ${error.path}`;
    case 'INVALID_PASSWORD':
      return `Invalid password for: ${error.path}`;
    case 'EXTRACTION_FAILED':
      return `Extraction failed: ${error.reason}`;
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
  }
}
