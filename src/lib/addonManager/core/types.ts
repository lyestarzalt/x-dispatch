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
  };
}

/**
 * Get user-friendly error message from SceneryError.
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
    case 'BACKUP_FAILED':
      return `Backup failed: ${error.reason}`;
  }
}
