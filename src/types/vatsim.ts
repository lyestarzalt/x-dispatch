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

export interface VatsimData {
  pilots: VatsimPilot[];
  controllers: VatsimController[];
  atis: VatsimATIS[];
  lastUpdate: Date;
}
