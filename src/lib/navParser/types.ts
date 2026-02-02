import { Coordinates, LonLatPath } from '@/types/geo';

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

export interface Waypoint extends Coordinates {
  id: string;
  region: string;
  areaCode: string;
  description: string;
}

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

type AirspaceClass =
  | 'A'
  | 'B'
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'CTR'
  | 'TMA'
  | 'R'
  | 'P'
  | 'Q'
  | 'W'
  | 'GP'
  | 'OTHER';

export interface Airspace {
  class: string;
  name: string;
  upperLimit: string;
  lowerLimit: string;
  coordinates: LonLatPath;
}

// === ATC Controller (Navigraph only) ===
export type ATCRole = 'ctr' | 'app' | 'twr' | 'gnd' | 'del';

export interface ATCController {
  name: string;
  facilityId: string;
  role: ATCRole;
  frequencies: number[]; // MHz (120.45, 123.80)
  airspace?: {
    minAlt: number;
    maxAlt: number;
    polygon: LonLatPath;
  };
}

// === Holding Pattern ===
export interface HoldingPattern {
  fixId: string;
  fixRegion: string;
  airport: string; // ICAO or "ENRT"
  fixType: number; // 11=fix, 3=VOR
  inboundCourse: number;
  legTime: number; // minutes
  legDistance: number; // nm (0 = use time)
  turnDirection: 'L' | 'R';
  minAlt: number;
  maxAlt: number;
  speedKts: number;
}

// === Airport Metadata ===
export interface AirportMetadata {
  icao: string;
  region: string;
  latitude: number;
  longitude: number;
  elevation: number;
  airportClass: 'C' | 'P'; // Controlled/Private
  longestRunway: number; // feet
  ifrCapable: boolean;
  transitionAlt: number; // feet
  transitionLevel: string; // "FL150" or feet
}

// === MORA (Minimum Off-Route Altitude) ===
export interface MORACell {
  latMin: number; // Grid cell south boundary
  latMax: number; // Grid cell north boundary
  lonMin: number; // Grid cell west boundary
  lonMax: number; // Grid cell east boundary
  altitude: number; // feet MSL
}

// === MSA (Minimum Sector Altitude) ===
export interface MSASector {
  fixId: string;
  fixRegion: string;
  sectorBearing1: number; // From bearing
  sectorBearing2: number; // To bearing
  radius: number; // nm
  altitude: number; // feet MSL
}

interface NavaidGeoJSON extends GeoJSON.FeatureCollection {
  features: GeoJSON.Feature<
    GeoJSON.Point,
    {
      type: NavaidType;
      id: string;
      name: string;
      frequency: number;
      elevation: number;
      range: number;
    }
  >[];
}

interface WaypointGeoJSON extends GeoJSON.FeatureCollection {
  features: GeoJSON.Feature<
    GeoJSON.Point,
    {
      id: string;
      region: string;
      description: string;
    }
  >[];
}

interface AirspaceGeoJSON extends GeoJSON.FeatureCollection {
  features: GeoJSON.Feature<
    GeoJSON.Polygon,
    {
      class: string;
      name: string;
      upperLimit: string;
      lowerLimit: string;
    }
  >[];
}

const NAV_COLORS = {
  VOR: '#2563eb',
  VORTAC: '#2563eb',
  'VOR-DME': '#2563eb',
  NDB: '#7c3aed',
  DME: '#06b6d4',
  TACAN: '#2563eb',
  WAYPOINT: '#22c55e',
  ILS: '#f59e0b',
  LOC: '#f59e0b',
  GS: '#f59e0b',
  OM: '#3b82f6',
  MM: '#f59e0b',
  IM: '#ffffff',
  FPAP: '#10b981',
  GLS: '#8b5cf6',
  LTP: '#10b981',
  FTP: '#10b981',
} as const;

const AIRSPACE_STYLES: Record<string, { fill: string; border: string; opacity: number }> = {
  A: { fill: '#3b82f6', border: '#1d4ed8', opacity: 0.15 },
  B: { fill: '#3b82f6', border: '#1d4ed8', opacity: 0.15 },
  C: { fill: '#d946ef', border: '#a21caf', opacity: 0.15 },
  D: { fill: '#3b82f6', border: '#3b82f6', opacity: 0.1 },
  E: { fill: '#22c55e', border: '#16a34a', opacity: 0.08 },
  F: { fill: '#f59e0b', border: '#d97706', opacity: 0.1 },
  G: { fill: '#6b7280', border: '#4b5563', opacity: 0.05 },
  CTR: { fill: '#3b82f6', border: '#3b82f6', opacity: 0.2 },
  TMA: { fill: '#d946ef', border: '#a21caf', opacity: 0.15 },
  R: { fill: '#ef4444', border: '#dc2626', opacity: 0.2 },
  P: { fill: '#ef4444', border: '#dc2626', opacity: 0.2 },
  Q: { fill: '#ef4444', border: '#b91c1c', opacity: 0.15 },
  W: { fill: '#f59e0b', border: '#d97706', opacity: 0.15 },
  GP: { fill: '#6b7280', border: '#4b5563', opacity: 0.1 },
  OTHER: { fill: '#6b7280', border: '#4b5563', opacity: 0.1 },
};
