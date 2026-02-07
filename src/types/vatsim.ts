import { Coordinates } from '@/types/geo';

export interface VatsimPilot extends Coordinates {
  cid: number;
  name: string;
  callsign: string;
  server: string;
  pilot_rating: number;
  altitude: number;
  groundspeed: number;
  transponder: string;
  heading: number;
  qnh_i_hg: number;
  qnh_mb: number;
  flight_plan: {
    flight_rules: string;
    aircraft: string;
    aircraft_faa: string;
    aircraft_short: string;
    departure: string;
    arrival: string;
    alternate: string;
    cruise_tas: string;
    altitude: string;
    deptime: string;
    enroute_time: string;
    fuel_time: string;
    remarks: string;
    route: string;
    assigned_transponder: string;
  } | null;
  logon_time: string;
  last_updated: string;
}

export interface VatsimController {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: number;
  rating: number;
  server: string;
  visual_range: number;
  text_atis: string[] | null;
  last_updated: string;
  logon_time: string;
}

export interface VatsimATIS {
  cid: number;
  name: string;
  callsign: string;
  frequency: string;
  facility: number;
  rating: number;
  server: string;
  visual_range: number;
  atis_code: string;
  text_atis: string[] | null;
  last_updated: string;
  logon_time: string;
}

export interface VatsimPrefile {
  cid: number;
  name: string;
  callsign: string;
  flight_plan: {
    flight_rules: string;
    aircraft: string;
    aircraft_faa: string;
    aircraft_short: string;
    departure: string;
    arrival: string;
    alternate: string;
    deptime: string;
    enroute_time: string;
    fuel_time: string;
    remarks: string;
    route: string;
    revision_id: number;
    assigned_transponder: string;
  } | null;
  last_updated: string;
}

export interface VatsimGeneral {
  version: number;
  update_timestamp: string;
  connected_clients: number;
  unique_users: number;
}

export interface VatsimData {
  general?: VatsimGeneral;
  pilots: VatsimPilot[];
  controllers: VatsimController[];
  atis: VatsimATIS[];
  prefiles?: VatsimPrefile[];
  lastUpdate: Date;
}

export interface VatsimEventOrganiser {
  region: string | null;
  division: string | null;
  subdivision: string | null;
  organised_by_vatsim: boolean;
}

export interface VatsimEventAirport {
  icao: string;
}

export interface VatsimEventRoute {
  departure: string;
  arrival: string;
  route: string;
}

export interface VatsimEvent {
  id: number;
  type: string;
  name: string;
  link: string;
  organisers: VatsimEventOrganiser[];
  airports: VatsimEventAirport[];
  routes: VatsimEventRoute[];
  start_time: string;
  end_time: string;
  short_description: string;
  description: string;
  banner: string;
}

export interface VatsimEventsResponse {
  data: VatsimEvent[];
}
