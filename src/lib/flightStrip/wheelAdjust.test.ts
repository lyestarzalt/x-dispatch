import { describe, expect, it } from 'vitest';
import {
  ADJUST_COMMANDS,
  ADJUST_PROFILES,
  adjustCommand,
  isAdjustable,
  pickAdjustProfile,
  wheelSteps,
} from './wheelAdjust';

describe('wheelSteps', () => {
  it('turns one mouse notch into one step and keeps nothing', () => {
    expect(wheelSteps(0, 100)).toEqual({ steps: 1, carry: 0 });
    expect(wheelSteps(0, -100)).toEqual({ steps: -1, carry: 0 });
  });

  it('accumulates trackpad deltas until a step is due', () => {
    const a = wheelSteps(0, 40);
    expect(a).toEqual({ steps: 0, carry: 40 });
    const b = wheelSteps(a.carry, 40);
    expect(b).toEqual({ steps: 0, carry: 80 });
    const c = wheelSteps(b.carry, 40);
    expect(c).toEqual({ steps: 1, carry: 0 });
  });

  it('drops the carry when the wheel reverses', () => {
    expect(wheelSteps(40, -20)).toEqual({ steps: 0, carry: -20 });
  });

  it('caps a fling at a few steps', () => {
    expect(wheelSteps(0, 5000).steps).toBe(3);
    expect(wheelSteps(0, -5000).steps).toBe(-3);
  });

  it('ignores empty and broken deltas', () => {
    expect(wheelSteps(30, 0)).toEqual({ steps: 0, carry: 30 });
    expect(wheelSteps(30, Number.NaN)).toEqual({ steps: 0, carry: 30 });
  });
});

describe('adjustCommand', () => {
  it('uses the fine command unless a coarse one exists and Shift is held', () => {
    expect(adjustCommand('altitude', 1, false)).toBe('sim/autopilot/altitude_up');
    expect(adjustCommand('altitude', -1, true)).toBe('sim/autopilot/altitude_down');
    expect(adjustCommand('com1', 1, false)).toBe('sim/radios/stby_com1_fine_up');
    expect(adjustCommand('com1', -1, true)).toBe('sim/radios/stby_com1_coarse_down');
  });

  it('names only X-Plane commands', () => {
    for (const commands of Object.values(ADJUST_COMMANDS)) {
      for (const name of Object.values(commands)) expect(name).toMatch(/^sim\//);
    }
  });
});

describe('pickAdjustProfile', () => {
  const ff777 = ADJUST_PROFILES.find((p) => p.id === 'ff777')!;
  const zibo = ADJUST_PROFILES.find((p) => p.id === 'zibo738')!;

  it('picks the 777 profile when X-Plane lists its MCP command', async () => {
    const exists = async (name: string) => name === ff777.signature;
    expect(await pickAdjustProfile({ icaoType: 'B772' }, exists)).toBe(ff777);
    expect(await pickAdjustProfile({ icaoType: 'B77W' }, exists)).toBe(ff777);
  });

  it('falls back to the default commands when the plugin is gone', async () => {
    const exists = async () => false;
    expect(await pickAdjustProfile({ icaoType: 'B772' }, exists)).toBeNull();
  });

  it('tells the Zibo from the default 737-800 by name', async () => {
    const exists = async () => true;
    expect(
      await pickAdjustProfile({ icaoType: 'B738', aircraftName: 'Boeing 737-800X' }, exists)
    ).toBe(zibo);
    expect(
      await pickAdjustProfile({ icaoType: 'B738', aircraftName: 'Boeing 737-800' }, exists)
    ).toBeNull();
  });

  it('never asks X-Plane about an aircraft that does not match', async () => {
    let asked = 0;
    await pickAdjustProfile({ icaoType: 'C172' }, async () => (asked++, true));
    expect(asked).toBe(0);
  });

  it('uses the profile command and keeps the default for readouts it lacks', () => {
    expect(adjustCommand('altitude', 1, false, ff777)).toBe('1-sim/command/mcpAltRotary_rotary+');
    expect(adjustCommand('com1', 1, false, ff777)).toBe('sim/radios/stby_com1_fine_up');
    expect(adjustCommand('speed', -1, false, zibo)).toBe('sim/autopilot/airspeed_down');
  });
});

describe('isAdjustable', () => {
  it('excludes readouts with nothing to turn', () => {
    expect(isAdjustable('altitude')).toBe(true);
    expect(isAdjustable('wind')).toBe(false);
    expect(isAdjustable('attitude')).toBe(false);
  });
});
