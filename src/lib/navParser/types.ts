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
