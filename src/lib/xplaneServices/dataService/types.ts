/**
 * Types for X-Plane data service
 */
import type { NavDataSources } from './cycleInfo';

// ============================================================================
// Airport Types
// ============================================================================

export interface Airport {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  type: 'land' | 'seaplane' | 'heliport';
}

export interface AirportSourceBreakdown {
  globalAirports: number;
  customScenery: number;
  customSceneryPacks: number;
}

export interface ParsedAirportEntry {
  icao: string;
  name: string;
  lat: number;
  lon: number;
  type: 'land' | 'seaplane' | 'heliport';
  elevation?: number;
  data: string;
  sourceFile: string;
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

// ============================================================================
// Cache Types
// ============================================================================

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

// ============================================================================
// Load Status Types
// ============================================================================

export interface DataLoadStatus {
  xplanePath: string | null;
  pathValid: boolean;
  airports: {
    loaded: boolean;
    count: number;
    source: string | null;
    breakdown: AirportSourceBreakdown;
  };
  navaids: {
    loaded: boolean;
    count: number;
    byType: Record<string, number>;
    source: string | null;
  };
  waypoints: { loaded: boolean; count: number; source: string | null };
  airspaces: { loaded: boolean; count: number; source: string | null };
  airways: { loaded: boolean; count: number; source: string | null };
  atc: { loaded: boolean; count: number; source: string | null } | null;
  holds: { loaded: boolean; count: number; source: string | null } | null;
  aptMeta: { loaded: boolean; count: number; source: string | null } | null;
  sources: NavDataSources | null;
}

export interface LoadStatusFlags {
  airports: boolean;
  navaids: boolean;
  waypoints: boolean;
  airspaces: boolean;
  airways: boolean;
  atc: boolean;
  holds: boolean;
  aptMeta: boolean;
}
