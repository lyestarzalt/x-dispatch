import type { IvaoPilot } from '@/types/ivao';
import type { NetworkFlightPlan, NetworkPilot } from '@/types/networkTraffic';
import type { Feet } from '@/types/units';
import type { VatsimPilot } from '@/types/vatsim';

/** Below this ground speed a pilot with no ground flag is taken to be on the ground. */
const GROUND_SPEED_KTS = 50;

/** Filed altitudes come as "35000", "FL350", "F350" or "A050"; anything else is null. */
export function parseFiledAltitudeFt(filed: string | null | undefined): Feet | null {
  if (!filed) return null;
  const value = filed.trim().toUpperCase();
  const level = value.match(/^(?:FL|F|A)(\d{2,3})$/);
  if (level) return (Number(level[1]) * 100) as Feet;
  if (/^\d+$/.test(value)) return Number(value) as Feet;
  return null;
}

function flightRules(code: string | null | undefined): NetworkFlightPlan['flightRules'] {
  const c = (code ?? '').trim().toUpperCase();
  if (c === 'I' || c === 'IFR') return 'IFR';
  if (c === 'V' || c === 'VFR') return 'VFR';
  return null;
}

function icaoOrNull(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toUpperCase();
  return /^[A-Z0-9]{3,4}$/.test(v) ? v : null;
}

export function fromVatsimPilot(p: VatsimPilot): NetworkPilot {
  const fp = p.flight_plan;
  return {
    network: 'vatsim',
    id: p.cid,
    callsign: p.callsign,
    name: p.name,
    latitude: p.latitude,
    longitude: p.longitude,
    altitudeFt: p.altitude,
    groundspeedKts: p.groundspeed,
    headingDeg: p.heading,
    transponder: p.transponder || null,
    onGround: p.groundspeed < GROUND_SPEED_KTS,
    flightPlan: fp
      ? {
          flightRules: flightRules(fp.flight_rules),
          aircraft: fp.aircraft_short || fp.aircraft_faa || null,
          departure: icaoOrNull(fp.departure),
          arrival: icaoOrNull(fp.arrival),
          alternate: icaoOrNull(fp.alternate),
          cruiseAltitudeFt: parseFiledAltitudeFt(fp.altitude),
          route: fp.route.trim(),
        }
      : null,
  };
}

/** Null for a session with no position yet. */
export function fromIvaoPilot(p: IvaoPilot): NetworkPilot | null {
  const track = p.lastTrack;
  if (!track) return null;
  const fp = p.flightPlan;
  return {
    network: 'ivao',
    id: p.id,
    callsign: p.callsign,
    // IVAO's public feed carries no display name.
    name: '',
    latitude: track.latitude,
    longitude: track.longitude,
    altitudeFt: track.altitude,
    groundspeedKts: track.groundSpeed,
    headingDeg: track.heading,
    transponder: track.transponder ? String(track.transponder).padStart(4, '0') : null,
    onGround: track.onGround,
    flightPlan: fp
      ? {
          flightRules: flightRules(fp.flightRules),
          aircraft: fp.aircraftId || null,
          departure: icaoOrNull(fp.departureId),
          arrival: icaoOrNull(fp.arrivalId),
          alternate: icaoOrNull(fp.alternateId),
          cruiseAltitudeFt: parseFiledAltitudeFt(fp.level || fp.cruiseLevel),
          route: fp.route.trim(),
        }
      : null,
  };
}

export interface LatLonBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function pilotsInBounds(pilots: NetworkPilot[], bounds: LatLonBounds): NetworkPilot[] {
  return pilots.filter(
    (p) =>
      p.latitude >= bounds.south &&
      p.latitude <= bounds.north &&
      p.longitude >= bounds.west &&
      p.longitude <= bounds.east
  );
}
