import { describe, expect, it } from 'vitest';
import type { PlaneState } from '@/types/xplane';
import {
  TARGET_OVERLAYS,
  applyOverlay,
  overlayDatarefNames,
  overlayFields,
  pickTargetOverlay,
} from './targetOverlays';

const ff777 = TARGET_OVERLAYS.find((o) => o.id === 'ff777')!;

describe('pickTargetOverlay', () => {
  it('matches every FlightFactor 777 variant and nothing else', () => {
    for (const icaoType of ['B772', 'B773', 'B77L', 'B77W']) {
      expect(pickTargetOverlay({ icaoType })).toBe(ff777);
    }
    expect(pickTargetOverlay({ icaoType: 'B738' })).toBeNull();
    expect(pickTargetOverlay({})).toBeNull();
  });
});

describe('overlay shape', () => {
  it('subscribes the VS window flag along with the values', () => {
    expect(overlayDatarefNames(ff777)).toContain('1-sim/output/mcp/isVsOpen');
    expect(overlayDatarefNames(ff777)).toContain('1-sim/output/mcp/alt');
  });

  it('owns the four dial fields and the mach switch', () => {
    expect([...overlayFields(ff777)].sort()).toEqual([
      'apAirspeed',
      'apAirspeedIsMach',
      'apAltitude',
      'apHeading',
      'apVerticalSpeed',
    ]);
  });
});

describe('applyOverlay', () => {
  it('writes the MCP values into the dial fields', () => {
    const state: Partial<PlaneState> = { apAltitude: 38400, apHeading: 69 };
    applyOverlay(state, ff777, {
      '1-sim/output/mcp/alt': 7800,
      '1-sim/output/mcp/hdg': 27,
      '1-sim/output/mcp/spd': 209,
      '1-sim/output/mcp/isMachTrg': 0,
    });
    expect(state).toEqual({
      apAltitude: 7800,
      apHeading: 27,
      apAirspeed: 209,
      apAirspeedIsMach: false,
    });
  });

  it('leaves the VS target unset while the VS window is closed', () => {
    const state: Partial<PlaneState> = { apVerticalSpeed: -500 };
    applyOverlay(state, ff777, { '1-sim/output/mcp/vs': -62, '1-sim/output/mcp/isVsOpen': 0 });
    expect(state.apVerticalSpeed).toBeUndefined();
    applyOverlay(state, ff777, { '1-sim/output/mcp/vs': -800, '1-sim/output/mcp/isVsOpen': 1 });
    expect(state.apVerticalSpeed).toBe(-800);
  });

  it('skips values that have not arrived yet', () => {
    const state: Partial<PlaneState> = { apHeading: 69 };
    applyOverlay(state, ff777, { '1-sim/output/mcp/alt': 7800 });
    expect(state).toEqual({ apHeading: 69, apAltitude: 7800 });
  });
});
