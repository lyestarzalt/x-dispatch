/**
 * Navigation Types - Navigation data types
 * All types related to navaids, waypoints, airways, airspace, procedures
 */
import type { Coordinates, LonLatPath } from './geo';

// ============================================================================
// Navaid Types
// ============================================================================

export enum NavaidRowCode {
  NDB = 2,
  VOR = 3,
  LOC = 4,
  LOC_STANDALONE = 5,
  GS = 6,
  OM = 7,
  MM = 8,
  IM = 9,
  DME_STANDALONE = 12,
  DME_NDB = 13,
  FPAP = 14,
  GLS = 15,
  LTP_FTP = 16,
}

export type NavaidType =
  | 'VOR'
  | 'VORTAC'
  | 'VOR-DME'
  | 'NDB'
  | 'DME'
  | 'TACAN'
  | 'ILS'
  | 'LOC'
  | 'GS'
  | 'OM'
  | 'MM'
  | 'IM'
  | 'FPAP'
  | 'GLS'
  | 'LTP'
  | 'FTP';

export interface Navaid extends Coordinates {
  type: NavaidType;
  id: string;
  name: string;
  elevation: number;
  frequency: number;
  range: number;
  magneticVariation: number;
  region: string;
  country: string;
  bearing?: number;
  associatedAirport?: string;
  associatedRunway?: string;
  glidepathAngle?: number;
  lengthOffset?: number;
  course?: number;
  thresholdCrossingHeight?: number;
  refPathIdentifier?: string;
  approachPerformance?: 'LP' | 'LPV' | 'APV-II' | 'GLS';
}

// ============================================================================
// Waypoint Types
// ============================================================================

export interface Waypoint extends Coordinates {
  id: string;
  region: string;
  areaCode: string;
  description: string;
}

// ============================================================================
// Airway Types
// ============================================================================

export interface AirwaySegment {
  name: string;
  fromFix: string;
  fromRegion: string;
  fromNavaidType: number;
  toFix: string;
  toRegion: string;
  toNavaidType: number;
  isHigh: boolean;
  direction: number;
  baseFl: number;
  topFl: number;
}

export interface AirwaySegmentWithCoords {
  name: string;
  fromFix: string;
  toFix: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  isHigh: boolean;
  baseFl: number;
  topFl: number;
}

// ============================================================================
// Airspace Types
// ============================================================================

export interface Airspace {
  class: string;
  name: string;
  upperLimit: string;
  lowerLimit: string;
  coordinates: LonLatPath;
}

// ============================================================================
// ATC Types
// ============================================================================

export type ATCRole = 'ctr' | 'app' | 'twr' | 'gnd' | 'del';

export interface ATCController {
  name: string;
  facilityId: string;
  role: ATCRole;
  frequencies: number[];
  airspace?: {
    minAlt: number;
    maxAlt: number;
    polygon: LonLatPath;
  };
}

// ============================================================================
// Holding Pattern Types
// ============================================================================

export interface HoldingPattern {
  fixId: string;
  fixRegion: string;
  airport: string;
  fixType: number;
  inboundCourse: number;
  legTime: number;
  legDistance: number;
  turnDirection: 'L' | 'R';
  minAlt: number;
  maxAlt: number;
  speedKts: number;
}

// ============================================================================
// Airport Metadata (from nav data)
// ============================================================================

export interface AirportMetadata extends Coordinates {
  icao: string;
  region: string;
  elevation: number;
  airportClass: 'C' | 'P';
  longestRunway: number;
  ifrCapable: boolean;
  transitionAlt: number;
  transitionLevel: string;
}
