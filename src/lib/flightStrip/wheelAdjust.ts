import type { FlightStripReadout } from './fields';

/** Readouts whose selected value the pilot can turn from the strip. */
export const ADJUSTABLE_READOUTS = [
  'speed',
  'altitude',
  'verticalSpeed',
  'heading',
  'com1',
  'qnh',
] as const satisfies readonly FlightStripReadout[];

export type AdjustableReadout = (typeof ADJUSTABLE_READOUTS)[number];

export function isAdjustable(readout: FlightStripReadout): readout is AdjustableReadout {
  return (ADJUSTABLE_READOUTS as readonly string[]).includes(readout);
}

interface AdjustCommands {
  up: string;
  down: string;
  /** Larger steps with Shift held; readouts without one keep the fine step. */
  coarseUp?: string;
  coarseDown?: string;
}

/**
 * X-Plane's own knob commands, so add-on aircraft that remap them turn their own
 * systems instead of the default autopilot. Names as listed in Commands.txt.
 */
export const ADJUST_COMMANDS: Record<AdjustableReadout, AdjustCommands> = {
  speed: { up: 'sim/autopilot/airspeed_up', down: 'sim/autopilot/airspeed_down' },
  altitude: { up: 'sim/autopilot/altitude_up', down: 'sim/autopilot/altitude_down' },
  verticalSpeed: {
    up: 'sim/autopilot/vertical_speed_up',
    down: 'sim/autopilot/vertical_speed_down',
  },
  heading: { up: 'sim/autopilot/heading_up', down: 'sim/autopilot/heading_down' },
  com1: {
    up: 'sim/radios/stby_com1_fine_up',
    down: 'sim/radios/stby_com1_fine_down',
    coarseUp: 'sim/radios/stby_com1_coarse_up',
    coarseDown: 'sim/radios/stby_com1_coarse_down',
  },
  qnh: { up: 'sim/instruments/barometer_up', down: 'sim/instruments/barometer_down' },
};

/** What the plane state tells about the loaded aircraft. */
export interface AircraftIdentity {
  icaoType?: string;
  aircraftName?: string;
}

/**
 * An aircraft whose panel ignores the default commands and listens to its own.
 * Commands live in the plugin's command table, which X-Plane lists over the API.
 */
export interface AdjustProfile {
  id: 'ff777' | 'zibo738';
  matches: (aircraft: AircraftIdentity) => boolean;
  /**
   * A command only this aircraft's plugin registers. Checked before the profile is
   * used: X-Plane keeps a plugin's commands listed for the whole session, so the
   * identity match alone could pick a profile for a plugin that already unloaded.
   */
  signature: string;
  commands: Partial<Record<AdjustableReadout, AdjustCommands>>;
}

const FF777 = '1-sim/command';
const ZIBO = 'laminar/B738';

export const ADJUST_PROFILES: readonly AdjustProfile[] = [
  {
    id: 'ff777',
    matches: ({ icaoType }) => /^B77[2-9LW]$/i.test(icaoType ?? ''),
    signature: `${FF777}/mcpAltRotary_rotary+`,
    commands: {
      speed: { up: `${FF777}/mcpSpdRotary_rotary+`, down: `${FF777}/mcpSpdRotary_rotary-` },
      altitude: { up: `${FF777}/mcpAltRotary_rotary+`, down: `${FF777}/mcpAltRotary_rotary-` },
      verticalSpeed: { up: `${FF777}/mcpVsRotary_rotary+`, down: `${FF777}/mcpVsRotary_rotary-` },
      heading: { up: `${FF777}/mcpHdgRotary_rotary+`, down: `${FF777}/mcpHdgRotary_rotary-` },
      qnh: {
        up: `${FF777}/cptHsiBaroRotary_rotary+`,
        down: `${FF777}/cptHsiBaroRotary_rotary-`,
      },
    },
  },
  {
    id: 'zibo738',
    matches: ({ icaoType, aircraftName }) =>
      /^B738$/i.test(icaoType ?? '') && /800X|zibo/i.test(aircraftName ?? ''),
    signature: `${ZIBO}/autopilot/altitude_up`,
    commands: {
      altitude: { up: `${ZIBO}/autopilot/altitude_up`, down: `${ZIBO}/autopilot/altitude_dn` },
      heading: { up: `${ZIBO}/autopilot/heading_up`, down: `${ZIBO}/autopilot/heading_dn` },
      qnh: { up: `${ZIBO}/pilot/barometer_up`, down: `${ZIBO}/pilot/barometer_down` },
    },
  },
];

/**
 * The profile for the loaded aircraft, or null for the default commands. `exists`
 * asks X-Plane whether a command is registered.
 */
export async function pickAdjustProfile(
  aircraft: AircraftIdentity,
  exists: (command: string) => Promise<boolean>
): Promise<AdjustProfile | null> {
  for (const profile of ADJUST_PROFILES) {
    if (profile.matches(aircraft) && (await exists(profile.signature))) return profile;
  }
  return null;
}

/** Swaps COM1 standby into active; add-on radios keep X-Plane's radios in step. */
export const COM1_FLIP_COMMAND = 'sim/radios/com1_standy_flip';

export function adjustCommand(
  readout: AdjustableReadout,
  direction: 1 | -1,
  coarse: boolean,
  profile: AdjustProfile | null = null
): string {
  const commands = profile?.commands[readout] ?? ADJUST_COMMANDS[readout];
  if (direction > 0) return (coarse && commands.coarseUp) || commands.up;
  return (coarse && commands.coarseDown) || commands.down;
}

/** One mouse notch is a delta of 100 and must be one step; a trackpad sends many small deltas. */
export const WHEEL_STEP_DELTA = 100;
/** A momentum fling must not spin a knob through dozens of steps. */
export const MAX_STEPS_PER_EVENT = 3;

/**
 * Turns wheel travel into whole knob steps, carrying the remainder to the next
 * event. Positive steps mean the wheel moved down (towards the user).
 */
export function wheelSteps(
  carry: number,
  delta: number,
  threshold: number = WHEEL_STEP_DELTA
): { steps: number; carry: number } {
  if (!Number.isFinite(delta) || delta === 0) return { steps: 0, carry };
  // A reversal drops what the previous direction had accumulated.
  const total = Math.sign(carry) === Math.sign(delta) ? carry + delta : delta;
  const whole = Math.trunc(total / threshold);
  // `|| 0` turns a negative zero into zero.
  const steps = Math.max(-MAX_STEPS_PER_EVENT, Math.min(MAX_STEPS_PER_EVENT, whole)) || 0;
  return { steps, carry: whole === 0 ? total : 0 };
}
