import type { Degrees, Feet, Knots } from '@/types/units';

/**
 * One shape for a pilot on either online network. VATSIM and IVAO publish different JSON;
 * the map, the pilot card and the planner hand-off only ever see this.
 */
export type NetworkId = 'vatsim' | 'ivao';

export interface NetworkFlightPlan {
  flightRules: 'IFR' | 'VFR' | null;
  /** ICAO type designator ("A320"), when filed. */
  aircraft: string | null;
  departure: string | null;
  arrival: string | null;
  alternate: string | null;
  /** Filed cruise in feet, parsed from "FL350", "F350", "A050" or "35000". */
  cruiseAltitudeFt: Feet | null;
  route: string;
}

export interface NetworkPilot {
  network: NetworkId;
  /** VATSIM cid or IVAO session id; unique per network, stable across polls. */
  id: number;
  callsign: string;
  name: string;
  latitude: number;
  longitude: number;
  altitudeFt: Feet;
  groundspeedKts: Knots;
  headingDeg: Degrees;
  transponder: string | null;
  /** IVAO reports it; VATSIM does not, so it is inferred from the ground speed. */
  onGround: boolean;
  flightPlan: NetworkFlightPlan | null;
}

/** What a controller position does, read off the callsign suffix (EDDF_TWR → TWR). */
export type AtcRole = 'DEL' | 'GND' | 'TWR' | 'APP' | 'CTR' | 'FSS' | 'ATIS' | 'OTHER';

/** One controller or ATIS position online on either network. */
export interface NetworkStation {
  network: NetworkId;
  callsign: string;
  /** Controller's display name; empty on IVAO's public feed. */
  name: string;
  /** "118.700"; empty when the network gives none. */
  frequency: string;
  role: AtcRole;
  /** The ATIS broadcast, on a VATSIM ATIS position or an IVAO controller carrying one. */
  atis: { code: string | null; lines: string[] } | null;
}

/** The positions online at one airport, for the dot's ring, its label strip and the panel. */
export interface AirportStaffing {
  icao: string;
  network: NetworkId;
  stations: NetworkStation[];
  /** Airport roles online, in D G T A order. */
  roles: AtcRole[];
  /** The role that colours the ring: the highest of APP, TWR, GND, DEL, else ATIS. */
  top: AtcRole;
  atisCode: string | null;
}
