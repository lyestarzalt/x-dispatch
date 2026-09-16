/**
 * SimBrief API Types
 * Types for the SimBrief OFP (Operational Flight Plan) API response
 *
 * Note: SimBrief returns most numeric values as strings
 */

// =============================================================================
// NOTAM Types
// =============================================================================

export interface SimBriefNotam {
  notam_id: string;
  notam_text: string;
  notam_raw: string;
  notam_qcode: string;
  notam_qcode_category: string;
  notam_qcode_subject: string;
  notam_qcode_status: string;
  date_effective: string;
  date_expire: string | null;
  date_expire_is_estimated?: string;
  location_icao: string;
  location_name: string;
}

// =============================================================================
// Airport Types
// =============================================================================

export interface SimBriefAirport {
  icao_code: string;
  iata_code: string;
  name: string;
  pos_lat: string;
  pos_long: string;
  elevation: string;
  timezone: string;
  plan_rwy: string;
  trans_alt: string;
  trans_level: string;
  metar: string;
  metar_time: string;
  metar_category: string;
  metar_visibility: string;
  metar_ceiling: string;
  taf: string;
  taf_time: string;
  notam?: SimBriefNotam[];
}

// =============================================================================
// Alternate Airport (extended with routing info)
// =============================================================================

export interface SimBriefAlternate extends SimBriefAirport {
  cruise_altitude: string;
  distance: string;
  gc_distance: string;
  air_distance: string;
  ete: string;
  burn: string;
  route: string;
  avg_wind_comp: string;
  avg_wind_dir: string;
  avg_wind_spd: string;
}

// =============================================================================
// Navlog / Fix Types
// =============================================================================

export interface SimBriefWindLevel {
  altitude: string;
  wind_dir: string;
  wind_spd: string;
  oat: string;
}

export interface SimBriefFirCrossing {
  fir_icao: string;
  fir_name: string;
  pos_lat_entry: string;
  pos_long_entry: string;
}

export interface SimBriefFix {
  ident: string;
  name: string;
  type: string;
  frequency?: string;
  pos_lat: string;
  pos_long: string;
  stage: string; // 'CLB' | 'CRZ' | 'DSC'
  via_airway: string;
  is_sid_star: string; // '0' | '1'
  distance: string;
  track_true: string;
  track_mag: string;
  altitude_feet: string;
  ind_airspeed: string;
  true_airspeed: string;
  mach: string;
  mach_thousandths: string;
  wind_component: string;
  groundspeed: string;
  time_leg: string;
  time_total: string;
  fuel_flow: string;
  fuel_leg: string;
  fuel_totalused: string;
  fuel_min_onboard: string;
  fuel_plan_onboard: string;
  oat: string;
  oat_isa_dev: string;
  wind_dir: string;
  wind_spd: string;
  shear: string;
  tropopause_feet: string;
  ground_height: string;
  mora?: string;
  fir: string;
  fir_units: string;
  fir_valid_levels: string;
  wind_data?: {
    level: SimBriefWindLevel[];
  };
  fir_crossing?: {
    fir?: SimBriefFirCrossing;
  };
}

// =============================================================================
// TLR (Takeoff & Landing Report) Types
// =============================================================================

export interface SimBriefTakeoffConditions {
  airport_icao: string;
  planned_runway: string;
  planned_weight: string;
  wind_direction: string;
  wind_speed: string;
  temperature: string;
  altimeter: string;
  surface_condition: string;
}

export interface SimBriefTakeoffRunway {
  identifier: string;
  length: string;
  elevation: string;
  gradient: string;
  true_course: string;
  magnetic_course: string;
  headwind_component: string;
  crosswind_component: string;
  ils_frequency?: string;
  flap_setting: string;
  thrust_setting: string;
  flex_temperature: string;
  max_temperature: string;
  max_weight: string;
  limit_code: string;
  speeds_v1: string;
  speeds_vr: string;
  speeds_v2: string;
  distance_decide: string;
  distance_reject: string;
}

export interface SimBriefLandingConditions {
  airport_icao: string;
  planned_runway: string;
  planned_weight: string;
  flap_setting: string;
  wind_direction: string;
  wind_speed: string;
  temperature: string;
  altimeter: string;
  surface_condition: string;
}

export interface SimBriefLandingDistance {
  weight: string;
  flap_setting: string;
  brake_setting: string;
  reverser_credit: string;
  speeds_vref: string;
  actual_distance: string;
  factored_distance: string;
}

export interface SimBriefLandingRunway {
  identifier: string;
  length: string;
  elevation: string;
  gradient: string;
  true_course: string;
  magnetic_course: string;
  headwind_component: string;
  crosswind_component: string;
  ils_frequency?: string;
  max_weight_dry: string;
  max_weight_wet: string;
}

export interface SimBriefTLR {
  takeoff: {
    conditions: SimBriefTakeoffConditions;
    runway: SimBriefTakeoffRunway[];
  };
  landing: {
    conditions: SimBriefLandingConditions;
    distance_dry: SimBriefLandingDistance;
    distance_wet: SimBriefLandingDistance;
    runway: SimBriefLandingRunway[];
  };
}

// =============================================================================
// SIGMET Types
// =============================================================================

export interface SimBriefSigmet {
  type: string;
  hazard: string;
  qualifier: string;
  fir: string;
  fir_name: string;
  id: string;
  issued: string;
  start: string;
  end: string;
  text: string;
}

// =============================================================================
// Fuel Types
// =============================================================================

export interface SimBriefFuel {
  taxi: string;
  enroute_burn: string;
  contingency: string;
  alternate_burn: string;
  reserve: string;
  etops: string;
  extra: string;
  min_takeoff: string;
  plan_takeoff: string;
  plan_ramp: string;
  plan_landing: string;
  avg_fuel_flow: string;
  max_tanks: string;
}

// =============================================================================
// Weight Types
// =============================================================================

export interface SimBriefWeights {
  oew: string;
  pax_count: string;
  pax_weight: string;
  bag_count: string;
  bag_weight: string;
  cargo: string;
  payload: string;
  freight_added: string;
  est_zfw: string;
  est_tow: string;
  est_ldw: string;
  est_ramp: string;
  max_zfw: string;
  max_tow: string;
  max_ldw: string;
  tow_limit_code: string;
}

// =============================================================================
// Times Types
// =============================================================================

export interface SimBriefTimes {
  est_time_enroute: string;
  sched_time_enroute: string;
  est_block: string;
  sched_block: string;
  sched_out: string;
  sched_off: string;
  sched_on: string;
  sched_in: string;
  est_out: string;
  est_off: string;
  est_on: string;
  est_in: string;
  orig_timezone: string;
  dest_timezone: string;
  taxi_out: string;
  taxi_in: string;
  reserve_time: string;
  endurance: string;
}

// =============================================================================
// General Flight Info Types
// =============================================================================

export interface SimBriefGeneral {
  release: string;
  icao_airline: string;
  flight_number: string;
  is_etops: string;
  cruise_profile: string;
  climb_profile: string;
  descent_profile: string;
  costindex: string;
  initial_altitude: string;
  stepclimb_string: string;
  avg_temp_dev: string;
  avg_tropopause: string;
  avg_wind_comp: string;
  avg_wind_dir: string;
  avg_wind_spd: string;
  gc_distance: string;
  route_distance: string;
  air_distance: string;
  total_burn: string;
  cruise_tas: string;
  cruise_mach: string;
  passengers: string;
  route: string;
  route_ifps: string;
  route_navigraph: string;
  sid_ident: string;
  sid_trans: string;
  star_ident: string;
  star_trans: string;
  airac: string;
}

// =============================================================================
// Aircraft Types
// =============================================================================

export interface SimBriefAircraft {
  icao_code: string;
  iata_code: string;
  base_type: string;
  name: string;
  reg: string;
  fin: string;
  selcal: string;
  engines: string;
  max_passengers: string;
  fuelfactor: string;
}

// =============================================================================
// ATC Types
// =============================================================================

export interface SimBriefATC {
  flightplan_text: string;
  route: string;
  route_ifps: string;
  callsign: string;
  flight_type: string;
  flight_rules: string;
  initial_spd: string;
  initial_spd_unit: string;
  initial_alt: string;
  initial_alt_unit: string;
  fir_orig: string;
  fir_dest: string;
  fir_altn: string;
  fir_enroute: string[];
}

// =============================================================================
// Crew Types
// =============================================================================

export interface SimBriefCrew {
  cpt: string;
  fo: string;
  dx: string;
  fa: string[];
}

// =============================================================================
// Images Types
// =============================================================================

export interface SimBriefImage {
  name: string;
  link: string;
}

export interface SimBriefImages {
  directory: string;
  map: SimBriefImage[];
}

// =============================================================================
// Files Types
// =============================================================================

export interface SimBriefFile {
  name: string;
  link: string;
}

export interface SimBriefFiles {
  directory: string;
  pdf: { name?: string; link: string };
  file?: SimBriefFile[];
}

// =============================================================================
// Impact Analysis Types (What-If Scenarios)
// =============================================================================

export interface SimBriefImpact {
  time_enroute: string;
  time_difference: string;
  enroute_burn: string;
  burn_difference: string;
  ramp_fuel: string;
  initial_fl: string;
  initial_tas: string;
  initial_mach: string;
  cost_index: string;
}

export interface SimBriefImpacts {
  minus_6000ft?: SimBriefImpact;
  minus_4000ft?: SimBriefImpact;
  minus_2000ft?: SimBriefImpact;
  plus_2000ft?: SimBriefImpact;
  plus_4000ft?: SimBriefImpact;
  plus_6000ft?: SimBriefImpact;
  higher_ci?: SimBriefImpact;
  lower_ci?: SimBriefImpact;
  zfw_plus_1000?: SimBriefImpact;
  zfw_minus_1000?: SimBriefImpact;
}

// =============================================================================
// Prefile Links Types
// =============================================================================

export interface SimBriefPrefileNetwork {
  name: string;
  site: string;
  link: string;
}

export interface SimBriefPrefile {
  vatsim: SimBriefPrefileNetwork;
  ivao: SimBriefPrefileNetwork;
  pilotedge: SimBriefPrefileNetwork;
  poscon: SimBriefPrefileNetwork;
}

// =============================================================================
// Links Types
// =============================================================================

export interface SimBriefLinks {
  skyvector: string;
}

// =============================================================================
// FMS Downloads Types
// TODO: Sync with Addon Manager - auto-detect user's aircraft inventory and
// show only relevant FMS download options (e.g., if user has Toliss A321,
// show the appropriate format). Could also auto-download to X-Plane FMS folder.
// =============================================================================

export interface SimBriefFmsFile {
  name: string;
  link: string;
}

export interface SimBriefFmsDownloads {
  directory: string;
  // X-Plane formats
  xpe?: SimBriefFmsFile; // X-Plane 11 FMS
  xpn?: SimBriefFmsFile; // X-Plane native
  xp9?: SimBriefFmsFile; // X-Plane 9/10
  // MSFS formats
  mfs?: SimBriefFmsFile; // MSFS 2020
  mfn?: SimBriefFmsFile; // MSFS navlog
  // Other popular formats
  psx?: SimBriefFmsFile; // PMDG
  fsl?: SimBriefFmsFile; // FSLabs
  ffa?: SimBriefFmsFile; // FlightFactor
  jar?: SimBriefFmsFile; // JARDesign
  ixg?: SimBriefFmsFile; // IXEG
  tfd?: SimBriefFmsFile; // ToLiss
  lvd?: SimBriefFmsFile; // Level-D
  // Generic
  pdf?: SimBriefFmsFile;
  [key: string]: SimBriefFmsFile | string | undefined;
}

// =============================================================================
// Weather Summary Types
// =============================================================================

export interface SimBriefWeatherSummary {
  orig_metar: string;
  orig_taf: string;
  dest_metar: string;
  dest_taf: string;
  altn_metar: string;
  altn_taf: string;
}

// =============================================================================
// Top-level NOTAMs Types
// =============================================================================

export interface SimBriefNotamRecord {
  notam_id: string;
  icao_id: string;
  icao_name: string;
  notam_text: string;
  notam_report: string;
  notam_qcode: string;
  notam_created_dtg: string;
  notam_effective_dtg: string;
  notam_expire_dtg?: string;
  notam_expire_dtg_estimated?: string;
}

export interface SimBriefNotams {
  notamdrec: SimBriefNotamRecord[];
  'rec-count': string;
}

// =============================================================================
// Text/OFP Output Types
// =============================================================================

export interface SimBriefText {
  plan_html: string;
  tlr_section?: string;
}

// =============================================================================
// Main OFP Type
// =============================================================================

export interface SimBriefOFP {
  fetch: {
    userid: string;
    status: string;
    time: string;
  };
  params: {
    request_id: string;
    user_id: string;
    time_generated: string;
    ofp_layout: string;
    airac: string;
    units: string;
  };
  general: SimBriefGeneral;
  origin: SimBriefAirport;
  destination: SimBriefAirport;
  alternate?: SimBriefAlternate;
  navlog: {
    fix: SimBriefFix[];
  };
  tlr?: SimBriefTLR;
  atc: SimBriefATC;
  aircraft: SimBriefAircraft;
  fuel: SimBriefFuel;
  weights: SimBriefWeights;
  times: SimBriefTimes;
  crew?: SimBriefCrew;
  impacts?: SimBriefImpacts;
  sigmets?: {
    sigmet: SimBriefSigmet[];
  };
  notams?: SimBriefNotams;
  weather?: SimBriefWeatherSummary;
  files: SimBriefFiles;
  fms_downloads?: SimBriefFmsDownloads;
  images?: SimBriefImages;
  links?: SimBriefLinks;
  prefile?: SimBriefPrefile;
  text?: SimBriefText;
}

/** IPC response type for SimBrief fetch */
export type SimBriefFetchResult =
  { success: true; data: SimBriefOFP } | { success: false; error: string };
