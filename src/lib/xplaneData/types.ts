/**
 * Types for apt.dat parsing
 */

export interface ParsedAirportEntry {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  type: 'land' | 'seaplane' | 'heliport';
  elevation?: number;
  data: string;
  sourceFile: string;
  // Metadata from 1302 rows
  city?: string;
  country?: string;
  iataCode?: string;
  faaCode?: string;
  regionCode?: string;
  state?: string;
  transitionAlt?: number;
  transitionLevel?: string;
  towerServiceType?: string;
  driveOnLeft?: boolean;
  guiLabel?: string;
}

export interface AptFileInfo {
  path: string;
  mtime: number;
}

export interface CacheCheckResult {
  needsReload: boolean;
  changedFiles: string[];
  newFiles: string[];
  deletedFiles: string[];
}
