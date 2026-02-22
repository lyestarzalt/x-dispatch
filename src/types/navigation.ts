/**
 * Navigation Types
 * Consolidated types for all navigation data: navaids, waypoints, airways,
 * airspace, procedures (SID/STAR/Approach), holdings, and ATC.
 */
import type { Coordinates, LonLatPath } from './geo';

// ============================================================================
// Common Enums - Used across multiple data types
// ============================================================================

/**
 * Fix type codes used in CIFP and airways
 * These indicate what kind of navigation point a fix is
 */
export type FixTypeCode =
  | 'A' // Airport
  | 'C' // Runway (in CIFP context)
  | 'D' // DME
  | 'E' // Enroute waypoint (fix)
  | 'N' // NDB
  | 'P' // Published waypoint (CIFP specific)
  | 'V'; // VOR

/**
 * Fix type codes as numbers (used in earth_awy.dat and earth_hold.dat)
 * Maps to NavaidRowCode for navaids, 11 = enroute waypoint
 */
export enum FixTypeNumber {
  NDB = 2,
  VOR = 3,
  LOC = 4,
  LOC_STANDALONE = 5,
  GS = 6,
  OM = 7,
  MM = 8,
  IM = 9,
  WAYPOINT = 11, // Enroute fix/waypoint
  DME_STANDALONE = 12,
  DME_NDB = 13,
}

/**
 * Turn direction for procedures and holdings
 */
export type TurnDirection = 'L' | 'R';

// ============================================================================
// Navaid Types (earth_nav.dat)
// ============================================================================

/**
 * Row codes in earth_nav.dat file
 * Each code represents a different navaid type
 */
export enum NavaidRowCode {
  NDB = 2,
  VOR = 3,
  LOC = 4, // Localizer (ILS component)
  LOC_STANDALONE = 5,
  GS = 6, // Glideslope
  OM = 7, // Outer marker
  MM = 8, // Middle marker
  IM = 9, // Inner marker
  DME_STANDALONE = 12,
  DME_NDB = 13, // Co-located DME/NDB
  FPAP = 14, // Final approach path alignment point
  GLS = 15, // GBAS landing system
  LTP_FTP = 16, // Landing threshold point / Fictitious threshold point
}

/**
 * Human-readable navaid type names
 */
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

/**
 * Navaid data from earth_nav.dat
 */
export interface Navaid extends Coordinates {
  type: NavaidType;
  id: string;
  name: string;
  elevation: number;
  frequency: number; // In Hz * 100 (e.g., 11550 = 115.50 MHz)
  range: number; // In nautical miles
  magneticVariation: number;
  region: string; // ICAO region code (e.g., "DA" for Algeria)
  country: string;
  // ILS/LOC/GS specific
  bearing?: number;
  associatedAirport?: string;
  associatedRunway?: string;
  glidepathAngle?: number;
  course?: number;
  // FPAP/LTP specific
  lengthOffset?: number;
  thresholdCrossingHeight?: number;
  refPathIdentifier?: string;
  approachPerformance?: 'LP' | 'LPV' | 'APV-II' | 'GLS';
}

// ============================================================================
// Waypoint Types (earth_fix.dat)
// ============================================================================

/**
 * Waypoint/fix type from earth_fix.dat
 */
export type WaypointType = 'ENRT'; // Currently only enroute fixes in the file

/**
 * Waypoint/fix data from earth_fix.dat
 */
export interface Waypoint extends Coordinates {
  id: string;
  region: string; // ICAO region code
  areaCode: string; // Area code for grouping
  description: string;
}

// ============================================================================
// Airway Types (earth_awy.dat)
// ============================================================================

/**
 * Airway direction codes
 * 0 = bidirectional, 1 = forward only, 2 = backward only
 */
export type AirwayDirection = 0 | 1 | 2;

/**
 * Airway segment from earth_awy.dat
 * Each segment connects two fixes along an airway
 */
export interface AirwaySegment {
  name: string;
  fromFix: string;
  fromRegion: string;
  fromNavaidType: FixTypeNumber;
  toFix: string;
  toRegion: string;
  toNavaidType: FixTypeNumber;
  isHigh: boolean; // true = high altitude (J/UJ airways), false = low (V/UV airways)
  direction: AirwayDirection;
  baseFl: number; // Base flight level
  topFl: number; // Top flight level
}

/**
 * Airway segment with resolved coordinates (for map display)
 */
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
// Airspace Types (airspace.txt - OpenAir format)
// ============================================================================

/**
 * Airspace class codes
 */
export type AirspaceClass =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'CTR' // Control zone
  | 'TMA' // Terminal maneuvering area
  | 'R' // Restricted
  | 'P' // Prohibited
  | 'Q' // Danger
  | 'W' // Warning
  | 'GP' // Glider prohibited
  | 'OTHER';

/**
 * Airspace boundary from airspace.txt
 */
export interface Airspace {
  class: AirspaceClass;
  name: string;
  upperLimit: string; // e.g., "FL195", "5000ft", "UNL"
  lowerLimit: string; // e.g., "GND", "3500ft", "FL100"
  coordinates: LonLatPath; // Polygon boundary
}

// ============================================================================
// Procedure Types (CIFP/{ICAO}.dat)
// ============================================================================

/**
 * Procedure type
 */
export type ProcedureType = 'SID' | 'STAR' | 'APPROACH';

/**
 * CIFP route type codes
 * Determines how procedure legs are organized
 */
export enum CIFPRouteType {
  RUNWAY_TRANSITION = 1,
  COMMON_ROUTE = 2,
  ENROUTE_TRANSITION_COMMON = 3,
  ENROUTE_TRANSITION = 5,
  RUNWAY_TRANSITION_STAR = 6,
}

/**
 * Path terminator codes - how to fly each leg
 */
export type PathTerminator =
  | 'IF' // Initial Fix
  | 'TF' // Track to Fix
  | 'CF' // Course to Fix
  | 'DF' // Direct to Fix
  | 'FA' // Fix to Altitude
  | 'FC' // Track from Fix for Distance
  | 'FD' // Track from Fix to DME Distance
  | 'FM' // From Fix to Manual termination
  | 'CA' // Course to Altitude
  | 'CD' // Course to DME Distance
  | 'CI' // Course to Intercept
  | 'CR' // Course to Radial termination
  | 'RF' // Constant Radius Arc
  | 'AF' // Arc to Fix
  | 'VA' // Heading to Altitude
  | 'VD' // Heading to DME Distance
  | 'VI' // Heading to Intercept
  | 'VM' // Heading to Manual termination
  | 'VR' // Heading to Radial termination
  | 'PI' // Procedure Turn
  | 'HA' // Racetrack to Altitude
  | 'HF' // Racetrack to Fix
  | 'HM'; // Racetrack to Manual termination

/**
 * Altitude constraint descriptor
 */
export type AltitudeDescriptor =
  | '+' // At or above
  | '-' // At or below
  | '@' // At exactly
  | 'B'; // Between (altitude1 and altitude2)

/**
 * Altitude constraint for procedure waypoints
 */
export interface AltitudeConstraint {
  descriptor: AltitudeDescriptor;
  altitude1: number | null; // Primary altitude (ft or FL)
  altitude2: number | null; // Secondary altitude (for 'B' between constraint)
}

/**
 * Waypoint within a procedure (SID/STAR/Approach)
 */
export interface ProcedureWaypoint {
  fixId: string;
  fixRegion: string;
  fixType: FixTypeCode;
  pathTerminator: PathTerminator;
  course: number | null; // Magnetic course in degrees
  distance: number | null; // Distance in nautical miles
  altitude: AltitudeConstraint | null;
  speed: number | null; // Speed constraint in knots
  turnDirection: TurnDirection | null;
}

/**
 * Procedure waypoint with resolved coordinates
 */
export interface ResolvedProcedureWaypoint extends ProcedureWaypoint {
  latitude?: number;
  longitude?: number;
  resolved: boolean;
}

/**
 * Complete procedure (SID, STAR, or Approach)
 */
export interface Procedure {
  type: ProcedureType;
  name: string;
  runway: string | null; // null for "ALL" runways
  transition: string | null; // Enroute transition name
  waypoints: ProcedureWaypoint[];
}

/**
 * Procedure with resolved waypoint coordinates
 */
export interface ResolvedProcedure extends Omit<Procedure, 'waypoints'> {
  waypoints: ResolvedProcedureWaypoint[];
}

/**
 * All procedures for an airport
 */
export interface AirportProcedures {
  icao: string;
  sids: Procedure[];
  stars: Procedure[];
  approaches: Procedure[];
}

/**
 * All procedures with resolved coordinates
 */
export interface ResolvedAirportProcedures {
  icao: string;
  sids: ResolvedProcedure[];
  stars: ResolvedProcedure[];
  approaches: ResolvedProcedure[];
}

// ============================================================================
// Holding Pattern Types (earth_hold.dat)
// ============================================================================

/**
 * Holding pattern from earth_hold.dat
 */
export interface HoldingPattern {
  fixId: string;
  fixRegion: string;
  airport: string;
  fixType: FixTypeNumber;
  inboundCourse: number; // Magnetic course
  legTime: number; // Minutes
  legDistance: number; // Nautical miles (0 if time-based)
  turnDirection: TurnDirection;
  minAlt: number; // Minimum altitude in feet
  maxAlt: number; // Maximum altitude in feet
  speedKts: number; // Maximum speed in knots
}

// ============================================================================
// ATC Types (atc.dat - Navigraph only)
// ============================================================================

/**
 * ATC facility role
 */
export type ATCRole = 'ctr' | 'app' | 'twr' | 'gnd' | 'del';

/**
 * ATC controller/facility from atc.dat
 */
export interface ATCController {
  name: string;
  facilityId: string;
  role: ATCRole;
  frequencies: number[]; // In Hz * 1000
  airspace?: {
    minAlt: number;
    maxAlt: number;
    polygon: LonLatPath;
  };
}

// ============================================================================
// Airport Metadata (earth_aptmeta.dat)
// ============================================================================

/**
 * Airport class from aptmeta
 */
export type AirportClass = 'C' | 'P'; // C = civil, P = ?

/**
 * Airport metadata from earth_aptmeta.dat
 */
export interface AirportMetadata extends Coordinates {
  icao: string;
  region: string;
  elevation: number;
  airportClass: AirportClass;
  longestRunway: number; // In feet
  ifrCapable: boolean;
  transitionAlt: number; // Transition altitude in feet
  transitionLevel: string; // e.g., "FL180"
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Coordinate resolver function signature
 * Used to look up coordinates for fix IDs
 */
export type CoordResolver = (
  fixId: string,
  region: string,
  type: FixTypeCode
) => Coordinates | null;

/**
 * Mapping from FixTypeCode to human-readable description
 */
export const FIX_TYPE_LABELS: Record<FixTypeCode, string> = {
  A: 'Airport',
  C: 'Runway',
  D: 'DME',
  E: 'Waypoint',
  N: 'NDB',
  P: 'Published Fix',
  V: 'VOR',
};

/**
 * Mapping from PathTerminator to human-readable description
 */
export const PATH_TERMINATOR_LABELS: Record<PathTerminator, string> = {
  IF: 'Initial Fix',
  TF: 'Track to Fix',
  CF: 'Course to Fix',
  DF: 'Direct to Fix',
  FA: 'Fix to Altitude',
  FC: 'Track from Fix for Distance',
  FD: 'Track from Fix to DME Distance',
  FM: 'From Fix to Manual',
  CA: 'Course to Altitude',
  CD: 'Course to DME Distance',
  CI: 'Course to Intercept',
  CR: 'Course to Radial',
  RF: 'Constant Radius Arc',
  AF: 'Arc to Fix',
  VA: 'Heading to Altitude',
  VD: 'Heading to DME Distance',
  VI: 'Heading to Intercept',
  VM: 'Heading to Manual',
  VR: 'Heading to Radial',
  PI: 'Procedure Turn',
  HA: 'Racetrack to Altitude',
  HF: 'Racetrack to Fix',
  HM: 'Racetrack to Manual',
};
