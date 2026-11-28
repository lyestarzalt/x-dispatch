import type { FileInUseError } from './fileErrors';

/**
 * Result type for operations that can fail.
 * Use instead of throwing exceptions for expected failures.
 */
export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/**
 * Scenery classification priority tiers.
 * Lower number = higher in scenery_packs.ini file.
 */
export enum SceneryPriority {
  FixedHighPriority = 0, // SAM library
  Airport = 1, // Custom airports
  DefaultAirport = 2, // Laminar gateway airports
  Library = 3, // Scenery libraries
  Other = 4, // Plugins, misc
  Overlay = 5, // DSF overlays
  AirportMesh = 6, // Airport-specific mesh
  Mesh = 7, // Terrain mesh
  Unrecognized = 8, // Unknown type
}

/**
 * DSF header parsing result - discriminated union, no null.
 */
export type DsfInfo =
  | { parsed: false }
  | {
      parsed: true;
      isOverlay: boolean;
      creationAgent: string;
      hasTerrainRefs: boolean;
    };

/**
 * Result of scanning a scenery folder for classification markers.
 */
export interface SceneryClassification {
  hasLibraryTxt: boolean;
  hasEarthNavData: boolean;
  hasAptDat: boolean;
  hasPlugins: boolean;
  hasDsf: boolean;
  dsfInfo: DsfInfo;
  dsfCount: number;
  dsfFilenames: string[];
  /** Full paths of the first few tiles, enough to learn which libraries the pack needs. */
  dsfPaths: string[];
  libraryExports: string[];
  /** Airports the pack's apt.dat declares, upper case, for spotting packs that overlap. */
  airportIcaos?: string[];
}

/**
 * A single scenery entry with classification and state.
 */
export interface SceneryEntry {
  folderName: string;
  fullPath: string;
  enabled: boolean;
  priority: SceneryPriority;
  classification: SceneryClassification;
  originalIndex: number;
  isGlobalAirports?: boolean;
  /** Original path as written in scenery_packs.ini (for absolute/external paths) */
  sceneryPath?: string;
  /** Libraries the pack's tiles reference that no installed package exports. */
  missingLibraries?: string[];
  /** Other packs that declare the same airports or ship the same mesh tiles. */
  conflicts?: import('../scenery/conflicts').SceneryConflicts;
}

/**
 * Parsed line from scenery_packs.ini.
 */
export interface ParsedIniEntry {
  folderName: string;
  fullPath: string;
  enabled: boolean;
  isGlobalAirports: boolean;
  originalLine: string;
  /** Original path as written in the INI (preserved for absolute/external paths) */
  sceneryPath?: string;
}

/**
 * Error types for scenery operations.
 */
export type SceneryError =
  | { code: 'INI_NOT_FOUND'; path: string }
  | { code: 'INI_PARSE_ERROR'; line: number; content: string }
  | { code: 'FOLDER_NOT_FOUND'; folderName: string }
  | { code: 'DSF_INVALID'; path: string; reason: string }
  | { code: 'DSF_COMPRESSED'; path: string }
  | { code: 'WRITE_FAILED'; path: string; reason: string }
  | { code: 'DELETE_FAILED'; path: string; reason: string }
  | FileInUseError
  | { code: 'BACKUP_FAILED'; reason: string };

/**
 * Create default classification for a scenery folder.
 */
export function createDefaultClassification(): SceneryClassification {
  return {
    hasLibraryTxt: false,
    hasEarthNavData: false,
    hasAptDat: false,
    hasPlugins: false,
    hasDsf: false,
    dsfInfo: { parsed: false },
    dsfCount: 0,
    dsfFilenames: [],
    dsfPaths: [],
    libraryExports: [],
  };
}

/**
 * Log text for a SceneryError. The renderer shows `sceneryErrorText` instead.
 */
export function getSceneryErrorMessage(error: SceneryError): string {
  switch (error.code) {
    case 'INI_NOT_FOUND':
      return `scenery_packs.ini not found at ${error.path}`;
    case 'INI_PARSE_ERROR':
      return `Failed to parse line ${error.line}: ${error.content}`;
    case 'FOLDER_NOT_FOUND':
      return `Scenery folder not found: ${error.folderName}`;
    case 'DSF_INVALID':
      return `Invalid DSF file: ${error.reason}`;
    case 'DSF_COMPRESSED':
      return `Compressed DSF not yet supported: ${error.path}`;
    case 'WRITE_FAILED':
      return `Failed to write: ${error.reason}`;
    case 'DELETE_FAILED':
      return `Delete failed: ${error.reason}`;
    case 'FILE_IN_USE':
      return `${error.fileName} is open in another program: ${error.reason}`;
    case 'BACKUP_FAILED':
      return `Backup failed: ${error.reason}`;
  }
}

/**
 * Error types for browser operations.
 */
export type BrowserError =
  | { code: 'NOT_FOUND'; path: string }
  | { code: 'SCAN_FAILED'; path: string; reason: string }
  | { code: 'TOGGLE_FAILED'; path: string; reason: string }
  | { code: 'DELETE_FAILED'; path: string; reason: string }
  | FileInUseError
  | { code: 'PATH_TRAVERSAL'; path: string }
  | { code: 'INVALID_INPUT'; field: string };

/** A translation key under `addonManager.<family>.errors` and the values its text quotes. */
export interface AddonErrorText {
  key: string;
  params: Record<string, string | number>;
}

/**
 * The renderer's text for a scenery failure, as an i18n key: the lib never
 * holds a user-facing sentence.
 */
export function sceneryErrorText(error: SceneryError): AddonErrorText {
  const key = `addonManager.scenery.errors.${error.code}`;
  switch (error.code) {
    case 'INI_NOT_FOUND':
    case 'DSF_COMPRESSED':
      return { key, params: { path: error.path } };
    case 'INI_PARSE_ERROR':
      return { key, params: { line: error.line, content: error.content } };
    case 'FOLDER_NOT_FOUND':
      return { key, params: { folderName: error.folderName } };
    case 'DSF_INVALID':
    case 'WRITE_FAILED':
    case 'DELETE_FAILED':
    case 'BACKUP_FAILED':
      return { key, params: { reason: error.reason } };
    case 'FILE_IN_USE':
      return { key, params: { fileName: error.fileName } };
  }
}

/** The renderer's text for an aircraft, plugin or script action that failed, as an i18n key. */
export function browserErrorText(error: BrowserError): AddonErrorText {
  const family = 'addonManager.browser.errors';
  switch (error.code) {
    case 'NOT_FOUND':
    case 'PATH_TRAVERSAL':
      return { key: `${family}.${error.code}`, params: { path: error.path } };
    case 'INVALID_INPUT':
      return { key: `${family}.INVALID_INPUT`, params: { field: error.field } };
    case 'SCAN_FAILED':
      return { key: `${family}.SCAN_FAILED`, params: { reason: error.reason } };
    case 'FILE_IN_USE':
      // X-Plane is the program holding a plugin; saying so is more use than the file name.
      if (isPluginFile(error.fileName) || isInPluginsFolder(error.path)) {
        return { key: `${family}.PLUGIN_IN_USE`, params: {} };
      }
      return { key: `${family}.FILE_IN_USE`, params: { fileName: error.fileName } };
    case 'TOGGLE_FAILED':
      if (isPermissionDenied(error.reason))
        return { key: `${family}.PERMISSION_DENIED`, params: {} };
      return { key: `${family}.TOGGLE_FAILED`, params: { reason: error.reason } };
    case 'DELETE_FAILED':
      if (isPermissionDenied(error.reason))
        return { key: `${family}.PERMISSION_DENIED`, params: {} };
      return { key: `${family}.DELETE_FAILED`, params: { reason: error.reason } };
  }
}

/** EPERM is Windows refusing a protected folder; EACCES is the POSIX spelling of the same. */
function isPermissionDenied(reason: string): boolean {
  return /\b(EPERM|EACCES)\b/.test(reason);
}

/** A plugin binary, enabled (.xpl) or switched off (.xfmp). */
function isPluginFile(fileName: string): boolean {
  return /\.(xpl|xfmp)$/i.test(fileName);
}

/** Inside `Resources/plugins`, where a locked file or folder is one X-Plane has loaded. */
function isInPluginsFolder(filePath: string): boolean {
  return /[\\/]Resources[\\/]plugins[\\/]/i.test(filePath);
}

/**
 * Log text for a BrowserError. The renderer shows `browserErrorText` instead.
 */
export function getBrowserErrorMessage(error: BrowserError): string {
  switch (error.code) {
    case 'NOT_FOUND':
      return `Not found: ${error.path}`;
    case 'SCAN_FAILED':
      return `Scan failed: ${error.reason}`;
    case 'FILE_IN_USE':
      return `${error.fileName} is open in another program: ${error.reason}`;
    case 'TOGGLE_FAILED':
      if (error.reason?.includes('EPERM')) {
        return `Permission denied. Your X-Plane folder is in a protected location that requires administrator access to modify. Try running X-Dispatch as administrator.`;
      }
      return `Toggle failed: ${error.reason}`;
    case 'DELETE_FAILED':
      if (error.reason?.includes('EPERM')) {
        return `Permission denied. Your X-Plane folder is in a protected location that requires administrator access to modify. Try running X-Dispatch as administrator.`;
      }
      return `Delete failed: ${error.reason}`;
    case 'PATH_TRAVERSAL':
      return `Invalid path: ${error.path}`;
    case 'INVALID_INPUT':
      return `Invalid input: ${error.field}`;
  }
}

/**
 * Scanned aircraft information.
 */
export interface AircraftInfo {
  folderName: string; // Relative path from Aircraft root
  displayName: string; // Folder name only
  acfFile: string; // Filename (.acf or .xfma)
  enabled: boolean; // .acf exists = enabled
  hasLiveries: boolean;
  liveryCount: number;
  version?: string;
  updateUrl?: string;
  latestVersion?: string;
  hasUpdate: boolean;
  locked: boolean;
  cfgDisabled?: boolean; // From skunkcrafts_updater.cfg disabled| field
  iconPath?: string; // Full path to icon11.png or icon10.png thumbnail
}

/**
 * Scanned plugin information.
 */
export interface PluginInfo {
  folderName: string;
  displayName: string;
  xplFiles: string[]; // Relative paths to .xpl/.xfmp files
  enabled: boolean; // Any .xpl exists = enabled
  platform: 'win' | 'mac' | 'lin' | 'multi' | 'unknown';
  version?: string;
  updateUrl?: string;
  latestVersion?: string;
  hasUpdate: boolean;
  locked: boolean;
  hasScripts: boolean; // FlyWithLua only
  scriptCount: number;
  cfgDisabled?: boolean; // From skunkcrafts_updater.cfg disabled| field
}

/**
 * Lua script in FlyWithLua/Scripts.
 */
export interface LuaScriptInfo {
  fileName: string; // With extension
  displayName: string; // Without extension
  enabled: boolean; // .lua = enabled, .xfml = disabled
}

/**
 * Livery for an aircraft.
 */
export interface LiveryInfo {
  folderName: string;
  displayName: string;
  iconPath?: string; // Full path to icon, undefined if not found
}

/**
 * Version data parsed from skunkcrafts_updater.cfg or version files.
 */
export interface VersionData {
  version: string;
  updateUrl?: string;
  cfgDisabled?: boolean;
}
