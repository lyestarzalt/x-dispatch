import type { StartPosition } from '@/types/position';
import { type Float, float } from '../float';

// Per-block strict types: every numeric field XP expects as a float is `Float`
// so a missing `float()` call fails to compile. These are assignable back to
// FlightInit's optional blocks because `Float` extends `number`.

export type RampBlock = { airport_id: string; ramp: string };

export type RunwayBlock = {
  airport_id: string;
  runway: string;
  final_distance_in_nautical_miles?: Float;
  tow_type?: 'tug' | 'winch' | 'none';
  tow_aircraft?: { path: string };
};

export type LleGroundBlock = {
  latitude: Float;
  longitude: Float;
  heading_true: Float;
};

export type LleAirBlock = {
  latitude: Float;
  longitude: Float;
  elevation_in_meters: Float;
  heading_true: Float;
  speed_in_meters_per_second?: Float;
  speed_enum?: 'short_field_approach' | 'normal_approach' | 'cruise';
};

export type BoatBlock = {
  boat_name: 'carrier' | 'frigate';
  boat_location: { latitude: Float; longitude: Float };
  start_position?: 'catapult_1' | 'catapult_2' | 'catapult_3' | 'catapult_4' | 'deck';
  final_distance_in_nautical_miles?: Float;
};

export function buildRamp(pos: StartPosition): RampBlock {
  return { airport_id: pos.airport, ramp: pos.name };
}

export function buildRunway(pos: StartPosition): RunwayBlock {
  const block: RunwayBlock = {
    airport_id: pos.airport,
    runway: pos.name,
  };
  if (pos.approachDistanceNm != null) {
    block.final_distance_in_nautical_miles = float(pos.approachDistanceNm);
  }
  if (pos.towType) {
    block.tow_type = pos.towType;
    if (pos.towType === 'tug') {
      block.tow_aircraft = {
        path: 'Aircraft/Laminar Research/Cessna 172 SP/Cessna_172SP.acf',
      };
    }
  }
  return block;
}

export function buildLleGround(pos: StartPosition): LleGroundBlock {
  return {
    latitude: float(pos.latitude),
    longitude: float(pos.longitude),
    heading_true: float(pos.heading),
  };
}

export function buildLleAir(pos: StartPosition): LleAirBlock {
  const block: LleAirBlock = {
    latitude: float(pos.latitude),
    longitude: float(pos.longitude),
    elevation_in_meters: float(pos.airAltitudeM ?? 1000),
    heading_true: float(pos.heading),
  };
  if (pos.airSpeedMs != null) {
    block.speed_in_meters_per_second = float(pos.airSpeedMs);
  } else if (pos.airSpeedEnum) {
    block.speed_enum = pos.airSpeedEnum;
  } else {
    block.speed_enum = 'normal_approach';
  }
  return block;
}

export function buildBoat(pos: StartPosition, boatName: 'carrier' | 'frigate'): BoatBlock {
  const block: BoatBlock = {
    boat_name: boatName,
    boat_location: {
      latitude: float(pos.latitude),
      longitude: float(pos.longitude),
    },
  };
  if (pos.boatPosition) {
    block.start_position = pos.boatPosition;
  } else if (pos.boatApproachNm != null) {
    block.final_distance_in_nautical_miles = float(pos.boatApproachNm);
  }
  return block;
}
