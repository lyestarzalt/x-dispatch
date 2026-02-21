/**
 * X-Plane FMS Flight Plan Types
 * Supports FMS v1100 format
 */

export type FMSWaypointType = 1 | 2 | 3 | 11 | 28;

export interface FMSWaypoint {
  type: FMSWaypointType;
  id: string;
  via: string; // ADEP, ADES, DRCT, or airway name
  altitude: number;
  latitude: number;
  longitude: number;
}

export interface FMSFlightPlan {
  version: number;
  cycle?: string;
  departure: {
    icao: string;
    runway?: string;
    sid?: string;
    sidTransition?: string;
  };
  arrival: {
    icao: string;
    runway?: string;
    star?: string;
    starTransition?: string;
    approach?: string;
    approachTransition?: string;
  };
  waypoints: FMSWaypoint[];
}

export interface FMSParseResult {
  success: boolean;
  data: FMSFlightPlan | null;
  error?: string;
}

// Chip types for UI rendering
export type FlightPlanChipType =
  | 'departure'
  | 'sid'
  | 'vor'
  | 'ndb'
  | 'fix'
  | 'latlon'
  | 'star'
  | 'arrival';

export interface FlightPlanChip {
  type: FlightPlanChipType;
  id: string;
  via?: string;
  altitude?: number;
  latitude?: number;
  longitude?: number;
  waypointIndex?: number; // Index in waypoints array for navigation
}
