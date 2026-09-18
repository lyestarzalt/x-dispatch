import { haversineDistance } from '@/lib/utils/geomath';
import type { FlightPhase } from '@/types/flightRecorder';
import type { SimFrame } from './frames';

export type PhaseEvent = 'flightStart' | 'liftoff' | 'touchdown' | 'flightEnd' | 'teleport';

export interface PhaseUpdate {
  phase: FlightPhase;
  changed: boolean;
  events: PhaseEvent[];
}

const TAXI_SPEED_MS = 3;
const PARK_SPEED_MS = 1;
const TAXI_IN_SPEED_MS = 15;
const MOVING_DEBOUNCE_S = 2;
const AIR_DEBOUNCE_S = 1;
const GROUND_DEBOUNCE_S = 1;
const TAKEOFF_TOP_M = 150;
const APPROACH_AGL_M = 915;
const VS_TREND_FPM = 300;
const TREND_DEBOUNCE_S = 15;
const LEVEL_DEBOUNCE_S = 60;
const PARK_DEBOUNCE_S = 20;
const PARK_TIMEOUT_S = 90;
const TELEPORT_M = 20_000;

const AIRBORNE_PHASES: ReadonlySet<FlightPhase> = new Set([
  'takeoff',
  'climb',
  'cruise',
  'descent',
  'approach',
]);

/**
 * Sim-time driven flight phase tracker. Paused frames do not advance any
 * timer because the frame clock itself stops; replay frames are ignored.
 * A flight opens on first movement or on the first airborne frame, and
 * closes after the aircraft has been parked for a while, on disconnect, or
 * when the position jumps.
 */
export class FlightPhaseMachine {
  private phase: FlightPhase = 'preflight';
  private open = false;
  private prev: SimFrame | null = null;
  private since = new Map<string, number>();

  get current(): FlightPhase {
    return this.phase;
  }

  get flightOpen(): boolean {
    return this.open;
  }

  /** Close the open flight without a frame, e.g. when X-Plane goes away. */
  forceEnd(): PhaseEvent[] {
    const events: PhaseEvent[] = this.open ? ['flightEnd'] : [];
    this.open = false;
    this.phase = 'preflight';
    this.prev = null;
    this.since.clear();
    return events;
  }

  push(frame: SimFrame): PhaseUpdate {
    if (frame.replay || frame.paused) {
      return { phase: this.phase, changed: false, events: [] };
    }
    const events: PhaseEvent[] = [];
    const before = this.phase;

    if (this.prev && this.jumped(this.prev, frame)) {
      events.push('teleport');
      if (this.open) events.push('flightEnd');
      this.open = false;
      this.phase = 'preflight';
      this.since.clear();
    }
    this.prev = frame;

    const t = frame.simT;
    const airborne = this.held('air', !frame.onGroundAny, t) >= AIR_DEBOUNCE_S;
    const grounded = this.held('ground', frame.onGroundAny, t) >= GROUND_DEBOUNCE_S;
    const moving =
      this.held('moving', frame.groundspeedMs >= TAXI_SPEED_MS, t) >= MOVING_DEBOUNCE_S;
    const stopped = this.held('stopped', frame.groundspeedMs < PARK_SPEED_MS, t);
    const climbing = this.held('climbing', frame.vsFpm > VS_TREND_FPM, t) >= TREND_DEBOUNCE_S;
    const descending = this.held('descending', frame.vsFpm < -VS_TREND_FPM, t) >= TREND_DEBOUNCE_S;
    const level = this.held('level', Math.abs(frame.vsFpm) <= VS_TREND_FPM, t) >= LEVEL_DEBOUNCE_S;
    const lowHeight = frame.aglM < APPROACH_AGL_M;
    const finalDescent = lowHeight && frame.vsFpm < -VS_TREND_FPM;

    if (!this.open) {
      if (airborne) {
        this.openFlight(events);
        this.phase = finalDescent ? 'approach' : frame.aglM > TAKEOFF_TOP_M ? 'climb' : 'takeoff';
      } else if (moving) {
        this.openFlight(events);
        this.phase = 'taxi-out';
      } else {
        this.phase = this.phase === 'parked' ? 'parked' : 'preflight';
      }
    } else if (AIRBORNE_PHASES.has(this.phase) && grounded) {
      this.phase = 'landed';
      events.push('touchdown');
    } else {
      switch (this.phase) {
        case 'taxi-out':
          if (airborne) {
            this.phase = 'takeoff';
            events.push('liftoff');
          }
          break;
        case 'takeoff':
          if (frame.aglM > TAKEOFF_TOP_M) this.phase = 'climb';
          break;
        case 'climb':
          if (finalDescent) this.phase = 'approach';
          else if (descending) this.phase = 'descent';
          else if (level && !lowHeight) this.phase = 'cruise';
          break;
        case 'cruise':
          if (finalDescent) this.phase = 'approach';
          else if (descending) this.phase = 'descent';
          else if (climbing) this.phase = 'climb';
          break;
        case 'descent':
          if (lowHeight) this.phase = 'approach';
          else if (climbing) this.phase = 'climb';
          else if (level) this.phase = 'cruise';
          break;
        case 'approach':
          if (climbing && !lowHeight) this.phase = 'climb';
          break;
        case 'landed':
          if (airborne) {
            this.phase = 'takeoff';
            events.push('liftoff');
          } else if (frame.groundspeedMs < TAXI_IN_SPEED_MS) {
            this.phase = 'taxi-in';
          }
          break;
        case 'taxi-in':
          if (airborne) {
            this.phase = 'takeoff';
            events.push('liftoff');
          } else if (stopped >= PARK_DEBOUNCE_S) {
            this.phase = 'parked';
          }
          break;
        case 'parked':
          if (moving || airborne) {
            events.push('flightEnd');
            this.open = false;
            this.openFlight(events);
            this.phase = airborne ? 'takeoff' : 'taxi-out';
          } else if (stopped >= PARK_TIMEOUT_S) {
            events.push('flightEnd');
            this.open = false;
          }
          break;
        case 'preflight':
          if (moving) this.phase = 'taxi-out';
          break;
      }
    }

    return { phase: this.phase, changed: this.phase !== before, events };
  }

  private openFlight(events: PhaseEvent[]): void {
    this.open = true;
    events.push('flightStart');
  }

  /** Seconds the condition has held continuously up to `t`; 0 when false. */
  private held(key: string, condition: boolean, t: number): number {
    if (!condition) {
      this.since.delete(key);
      return 0;
    }
    const start = this.since.get(key);
    if (start === undefined) {
      this.since.set(key, t);
      return 0;
    }
    return t - start;
  }

  private jumped(a: SimFrame, b: SimFrame): boolean {
    return haversineDistance(a.lat, a.lon, b.lat, b.lon) > TELEPORT_M;
  }
}
