/**
 * IPC Types - Electron IPC response formats
 * Types used for communication between main and renderer processes
 */

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse {
  data: string | null;
  error: string | null;
}

// ============================================================================
// X-Plane Service Types
// ============================================================================

export type XPlaneFlightConfig = Record<string, unknown>;

// ============================================================================
// Navigation Database Types
// ============================================================================

export interface NavDBStatus {
  status: {
    navaids: boolean;
    waypoints: boolean;
    airspaces: boolean;
    airways: boolean;
  };
  counts: {
    navaids: number;
    waypoints: number;
    airspaces: number;
    airways: number;
  };
}

export interface NavLoadResult {
  success: boolean;
  counts?: { navaids: number; waypoints: number; airspaces: number; airways: number };
  error?: string;
}

export interface NavSearchResult {
  type: 'VOR' | 'NDB' | 'DME' | 'ILS' | 'WAYPOINT';
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  frequency?: number;
}

// ============================================================================
// X-Plane Path Types
// ============================================================================

export interface PathValidation {
  valid: boolean;
  errors: string[];
}

export interface PathSetResult {
  success: boolean;
  errors: string[];
}

export interface BrowseResult {
  path: string;
  valid: boolean;
  errors: string[];
}
