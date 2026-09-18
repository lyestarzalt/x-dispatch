/**
 * One simulator frame as seen over the Web API. Values arrive as separate
 * dataref messages; the recorder snapshots them whenever the flight-time
 * clock ticks, which happens once per rendered frame and never while paused.
 */
export interface SimFrame {
  /** `sim/time/total_flight_time_sec`, the frame clock. */
  simT: number;
  /** Wall clock when the frame was assembled, epoch ms. */
  wallT: number;
  lat: number;
  lon: number;
  altM: number;
  aglM: number;
  groundspeedMs: number;
  headingDeg: number;
  /** `sim/flightmodel/position/vh_ind_fpm`, X-Plane's true vertical speed. */
  vsFpm: number;
  gNormal: number;
  onGroundAny: boolean;
  onGroundAll: boolean;
  /** Body pitch rate, degrees per second. */
  pitchRateDegSec: number;
  pitchDeg: number;
  rollDeg: number;
  paused: boolean;
  replay: boolean;
  fuelKg: number | null;
}

export const RECORDER_DATAREFS = {
  flightTime: 'sim/time/total_flight_time_sec',
  latitude: 'sim/flightmodel/position/latitude',
  longitude: 'sim/flightmodel/position/longitude',
  elevation: 'sim/flightmodel/position/elevation',
  agl: 'sim/flightmodel/position/y_agl',
  groundspeed: 'sim/flightmodel/position/groundspeed',
  heading: 'sim/flightmodel/position/psi',
  verticalSpeed: 'sim/flightmodel/position/vh_ind_fpm',
  gNormal: 'sim/flightmodel2/misc/gforce_normal',
  onGroundAny: 'sim/flightmodel/failures/onground_any',
  onGroundAll: 'sim/flightmodel/failures/onground_all',
  pitchRate: 'sim/flightmodel/position/Q',
  pitch: 'sim/flightmodel/position/theta',
  roll: 'sim/flightmodel/position/phi',
  paused: 'sim/time/paused',
  replay: 'sim/time/is_in_replay',
  fuelTotal: 'sim/flightmodel/weight/m_fuel_total',
} as const;

export const RECORDER_DATAREF_NAMES: string[] = Object.values(RECORDER_DATAREFS);

const REQUIRED_FOR_FRAME = [
  RECORDER_DATAREFS.latitude,
  RECORDER_DATAREFS.longitude,
  RECORDER_DATAREFS.elevation,
  RECORDER_DATAREFS.agl,
  RECORDER_DATAREFS.groundspeed,
  RECORDER_DATAREFS.heading,
  RECORDER_DATAREFS.onGroundAny,
] as const;

/**
 * Collects dataref updates and turns each flight-time tick into a SimFrame.
 * Returns null until every position dataref has been seen at least once.
 */
export class FrameAssembler {
  private values = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  update(name: string, value: number | number[]): SimFrame | null {
    const scalar = Array.isArray(value) ? value[0] : value;
    if (typeof scalar !== 'number' || !Number.isFinite(scalar)) return null;
    this.values.set(name, scalar);
    if (name !== RECORDER_DATAREFS.flightTime) return null;
    return this.snapshot(scalar);
  }

  reset(): void {
    this.values.clear();
  }

  private snapshot(simT: number): SimFrame | null {
    for (const name of REQUIRED_FOR_FRAME) {
      if (!this.values.has(name)) return null;
    }
    const v = (name: string, fallback = 0): number => this.values.get(name) ?? fallback;
    return {
      simT,
      wallT: this.now(),
      lat: v(RECORDER_DATAREFS.latitude),
      lon: v(RECORDER_DATAREFS.longitude),
      altM: v(RECORDER_DATAREFS.elevation),
      aglM: v(RECORDER_DATAREFS.agl),
      groundspeedMs: v(RECORDER_DATAREFS.groundspeed),
      headingDeg: v(RECORDER_DATAREFS.heading),
      vsFpm: v(RECORDER_DATAREFS.verticalSpeed),
      gNormal: v(RECORDER_DATAREFS.gNormal, 1),
      onGroundAny: v(RECORDER_DATAREFS.onGroundAny) >= 0.5,
      onGroundAll: v(RECORDER_DATAREFS.onGroundAll) >= 0.5,
      pitchRateDegSec: v(RECORDER_DATAREFS.pitchRate),
      pitchDeg: v(RECORDER_DATAREFS.pitch),
      rollDeg: v(RECORDER_DATAREFS.roll),
      paused: v(RECORDER_DATAREFS.paused) >= 0.5,
      replay: v(RECORDER_DATAREFS.replay) >= 0.5,
      fuelKg: this.values.has(RECORDER_DATAREFS.fuelTotal) ? v(RECORDER_DATAREFS.fuelTotal) : null,
    };
  }
}
