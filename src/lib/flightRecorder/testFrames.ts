import type { SimFrame } from './frames';

export const BASE_FRAME: SimFrame = {
  simT: 0,
  wallT: 1_700_000_000_000,
  lat: 50,
  lon: 8,
  altM: 1000,
  aglM: 900,
  groundspeedMs: 70,
  headingDeg: 90,
  vsFpm: 0,
  gNormal: 1,
  onGroundAny: false,
  onGroundAll: false,
  pitchRateDegSec: 0,
  pitchDeg: 3,
  rollDeg: 0,
  paused: false,
  replay: false,
  fuelKg: 5000,
};

export function frame(overrides: Partial<SimFrame>): SimFrame {
  return { ...BASE_FRAME, ...overrides, wallT: BASE_FRAME.wallT + (overrides.simT ?? 0) * 1000 };
}

/**
 * A straight-in approach at a constant descent rate, sampled at `hz`, ending
 * with the wheels on the ground and a rollout. Returns frames from `startAgl`
 * down to touchdown then `rolloutSec` seconds on the ground.
 */
export function approachFrames(opts: {
  descentFpm: number;
  startAglM?: number;
  hz?: number;
  rolloutSec?: number;
  pitchRateAtContact?: number;
  peakG?: number;
  startSimT?: number;
}): SimFrame[] {
  const hz = opts.hz ?? 30;
  const dt = 1 / hz;
  const descentMs = (Math.abs(opts.descentFpm) * 0.3048) / 60;
  const startAgl = opts.startAglM ?? 30;
  const rolloutSec = opts.rolloutSec ?? 5;
  let t = opts.startSimT ?? 0;
  let agl = startAgl;
  const frames: SimFrame[] = [];

  while (agl > 0) {
    frames.push(
      frame({
        simT: t,
        aglM: agl,
        altM: 100 + agl,
        vsFpm: -Math.abs(opts.descentFpm),
        groundspeedMs: 65,
        pitchRateDegSec: opts.pitchRateAtContact ?? 0,
      })
    );
    t += dt;
    agl -= descentMs * dt;
  }

  const contactT = t;
  const rolloutFrames = Math.round(rolloutSec * hz);
  for (let i = 0; i <= rolloutFrames; i++) {
    const sinceContact = i * dt;
    frames.push(
      frame({
        simT: contactT + sinceContact,
        aglM: 0,
        altM: 100,
        vsFpm: 0,
        groundspeedMs: Math.max(0, 65 - sinceContact * 8),
        onGroundAny: true,
        onGroundAll: sinceContact > 1.5,
        gNormal: sinceContact < 0.2 ? (opts.peakG ?? 1.3) : 1,
        pitchRateDegSec: sinceContact < 0.2 ? (opts.pitchRateAtContact ?? 0) : -1.5,
      })
    );
  }
  return frames;
}
