import { Coordinates, LonLatPath, LonLatPolygon } from '@/types/geo';

export enum RowCode {
  AIRPORT_HEADER = 1,
  TOWER_LOCATION = 14,
  BEACON = 18,
  WINDSOCK = 19,
  FREQUENCY_AWOS = 50,
  FREQUENCY_CTAF = 51,
  FREQUENCY_DELIVERY = 52,
  FREQUENCY_GROUND = 53,
  FREQUENCY_TOWER = 54,
  FREQUENCY_APPROACH = 55,
  FREQUENCY_CENTER = 56,
  FREQUENCY_UNICOM = 57,
  TAXI_SIGN = 20,
  LAND_RUNWAY = 100,
  HELIPAD = 102,
  TAXIWAY = 110,
  FREE_CHAIN = 120,
  BOUNDARY = 130,
  LINE_SEGMENT = 111,
  LINE_CURVE = 112,
  RING_SEGMENT = 113,
  RING_CURVE = 114,
  END_SEGMENT = 115,
  END_CURVE = 116,
  START_LOCATION_NEW = 1300,
  METADATA = 1302,
}

export enum LineType {
  NONE = 0,
  SOLID_YELLOW = 1,
  BROKEN_YELLOW = 2,
  DOUBLE_SOLID_YELLOW = 3,
  RUNWAY_HOLD = 4,
  OTHER_HOLD = 5,
  ILS_HOLD = 6,
  ILS_CRITICAL_CENTERLINE = 7,
  SEPARATED_BROKEN_YELLOW = 8,
  SEPARATED_DOUBLE_BROKEN_YELLOW = 9,
  WIDE_SOLID_YELLOW = 10,
  WIDE_ILS_CRITICAL_CENTERLINE = 11,
  WIDE_RUNWAY_HOLD = 12,
  WIDE_OTHER_HOLD = 13,
  WIDE_ILS_HOLD = 14,
  SOLID_YELLOW_WITH_BLACK_BORDER = 51,
  BROKEN_YELLOW_WITH_BLACK_BORDER = 52,
  DOUBLE_SOLID_YELLOW_WITH_BLACK_BORDER = 53,
  RUNWAY_HOLD_WITH_BLACK_BORDER = 54,
  OTHER_HOLD_WITH_BLACK_BORDER = 55,
  ILS_HOLD_WITH_BLACK_BORDER = 56,
  ILS_CRITICAL_CENTERLINE_WITH_BLACK_BORDER = 57,
  SEPARATED_BROKEN_YELLOW_WITH_BLACK_BORDER = 58,
  SEPARATED_DOUBLE_BROKEN_YELLOW_WITH_BLACK_BORDER = 59,
  WIDE_SOLID_YELLOW_WITH_BLACK_BORDER = 60,
  WIDE_ILS_CRITICAL_CENTERLINE_WITH_BLACK_BORDER = 61,
  WIDE_RUNWAY_HOLD_WITH_BLACK_BORDER = 62,
  WIDE_OTHER_HOLD_WITH_BLACK_BORDER = 63,
  WIDE_ILS_HOLD_WITH_BLACK_BORDER = 64,
  VERY_WIDE_YELLOW = 19,
  SOLID_WHITE = 20,
  CHEQUERED_WHITE = 21,
  BROKEN_WHITE = 22,
  SHORT_BROKEN_WHITE = 23,
  WIDE_SOLID_WHITE = 24,
  WIDE_BROKEN_WHITE = 25,
  SOLID_RED = 30,
  BROKEN_RED = 31,
  WIDE_SOLID_RED = 32,
  SOLID_ORANGE = 40,
  SOLID_BLUE = 41,
  SOLID_GREEN = 42,
  SOLID_WHITE_WITH_BLACK_BORDER = 70,
  CHEQUERED_WHITE_WITH_BLACK_BORDER = 71,
  BROKEN_WHITE_WITH_BLACK_BORDER = 72,
  SHORT_BROKEN_WHITE_WITH_BLACK_BORDER = 73,
  WIDE_SOLID_WHITE_WITH_BLACK_BORDER = 74,
  WIDE_BROKEN_WHITE_WITH_BLACK_BORDER = 75,
  SOLID_RED_WITH_BLACK_BORDER = 80,
  BROKEN_RED_WITH_BLACK_BORDER = 81,
  WIDE_SOLID_RED_WITH_BLACK_BORDER = 82,
  SOLID_ORANGE_WITH_BLACK_BORDER = 90,
  SOLID_BLUE_WITH_BLACK_BORDER = 91,
  SOLID_GREEN_WITH_BLACK_BORDER = 92,
}

export enum LineLightingType {
  NONE = 0,
  GREEN_BIDIRECTIONAL_LIGHTS = 101,
  BLUE_OMNIDIRECTIONAL_LIGHTS = 102,
  AMBER_UNIDIRECTIONAL_LIGHTS = 103,
  AMBER_UNIDIRECTIONAL_PULSATING_LIGHTS = 104,
  ALTERNATING_AMBER_GREEN_BIDIRECTIONAL_LIGHTS = 105,
  RED_OMNIDIRECTIONAL_LIGHTS = 106,
  GREEN_UNIDIRECTIONAL_LIGHTS = 107,
  ALTERNATING_AMBER_GREEN_UNIDIRECTIONAL_LIGHTS = 108,
}

export enum SurfaceType {
  ASPHALT = 1,
  CONCRETE = 2,
  TURF_OR_GRASS = 3,
  DIRT = 4,
  GRAVEL = 5,
  DRY_LAKEBED = 12,
  WATER_RUNWAY = 13,
  SNOW_OR_ICE = 14,
  TRANSPARENT = 15,
}

export enum ShoulderSurfaceType {
  NONE = 0,
  ASPHALT = 1,
  CONCRETE = 2,
  // X-Plane 12 also supports surface codes 20-38 (asphalt variants) and 50-57 (concrete variants)
}

export enum RunwayMarking {
  VISUAL = 1,
  NON_PRECISION = 2,
  PRECISION = 3,
}

export enum ApproachLighting {
  NONE = 0,
  ALSF_I = 1,
  ALSF_II = 2,
  CALVERT = 3,
  CALVERT_II = 4,
  SSALR = 5,
  SSALF = 6,
  SALS = 7,
  MALSR = 8,
  MALSF = 9,
  MALS = 10,
  ODALS = 11,
  RAIL = 12,
}

export enum RunwayEndIdentifierLights {
  NONE = 0,
  OMNIDIRECTIONAL_REIL = 1,
  UNIDIRECTIONAL_REIL = 2,
}

export enum SignSize {
  SMALL = 1,
  MEDIUM = 2,
  LARGE = 3,
  LARGE_DISTANCE_REMAINING = 4,
  SMALL_DISTANCE_REMAINING = 5,
}

interface AptMetadata {
  [key: string]: string | null;
}

interface Boundary {
  name: string;
  coordinates: LonLatPath;
}

export interface Pavement {
  surface_type: SurfaceType;
  smoothness: number;
  texture_orientation: number;
  name: string;
  coordinates: LonLatPath;
  holes?: LonLatPolygon;
}

export interface LinearFeature {
  name: string;
  painted_line_type: LineType;
  lighting_line_type: LineLightingType;
  coordinates: LonLatPath;
}

export interface RunwayEnd extends Coordinates {
  name: string;
  dthr_length: number;
  overrun_length: number;
  marking: RunwayMarking;
  lighting: ApproachLighting;
  tdz_lighting: boolean;
  reil: RunwayEndIdentifierLights;
}

export interface Runway {
  width: number;
  surface_type: SurfaceType;
  shoulder_surface_type: ShoulderSurfaceType;
  shoulder_width: number;
  smoothness: number;
  centerline_lights: boolean;
  edge_lights: boolean;
  auto_distance_remaining_signs: boolean;
  ends: [RunwayEnd, RunwayEnd];
}

export interface StartupLocation extends Coordinates {
  heading: number;
  location_type: string;
  airplane_types: string;
  name: string;
}

export interface Windsock extends Coordinates {
  illuminated: boolean;
  name: string;
}

export interface Sign extends Coordinates {
  heading: number;
  size: SignSize;
  text: string;
}

export interface LineProps {
  painted_line_type?: number;
  lighting_line_type?: number;
}

export interface CoordLineType {
  lineType: number;
  lightType: number;
}

export interface ParsedPath {
  coordinates: LonLatPath;
  properties: LineProps;
  lineTypes?: CoordLineType[];
  isHole?: boolean;
}

export interface Frequency {
  type: FrequencyType;
  frequency: number;
  name: string;
}

export enum FrequencyType {
  AWOS = 'AWOS',
  CTAF = 'CTAF',
  DELIVERY = 'DELIVERY',
  GROUND = 'GROUND',
  TOWER = 'TOWER',
  APPROACH = 'APPROACH',
  CENTER = 'CENTER',
  UNICOM = 'UNICOM',
}

export interface TowerLocation extends Coordinates {
  height: number;
  name: string;
}

export interface Beacon extends Coordinates {
  type: number;
  name: string;
}

export interface Helipad extends Coordinates {
  name: string;
  heading: number;
  length: number;
  width: number;
  surface_type: SurfaceType;
}

export interface TaxiwayFeature {
  surface: number;
  smoothness: number;
  orientation: number;
  paths: ParsedPath[];
}

export interface BoundaryFeature {
  paths: ParsedPath[];
}
