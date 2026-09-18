import { describe, expect, it } from 'vitest';
import type { LandingReport } from '@/types/flightRecorder';
import type { SimFrame } from './frames';
import { LandingDetector, descentRateFpm, flareGrade } from './landingDetector';
import { approachFrames, frame } from './testFrames';

function run(frames: SimFrame[]): LandingReport[] {
  const detector = new LandingDetector();
  const reports: LandingReport[] = [];
  for (const f of frames) {
    const report = detector.push(f);
    if (report) reports.push(report);
  }
  return reports;
}

describe('descentRateFpm', () => {
  it('recovers a constant descent from height samples', () => {
    const samples = [];
    for (let i = 0; i <= 15; i++) {
      samples.push({ t: i / 30, aglM: 10 - i * (1 / 30) });
    }
    expect(descentRateFpm(samples)).toBeCloseTo(-196.85, 0);
  });

  it('needs at least two samples', () => {
    expect(descentRateFpm([])).toBeNull();
    expect(descentRateFpm([{ t: 0, aglM: 1 }])).toBeNull();
  });
});

describe('flareGrade', () => {
  it('grades by pitch rate magnitude and sign', () => {
    expect(flareGrade(0.5)).toBe('veryGood');
    expect(flareGrade(-0.9)).toBe('veryGood');
    expect(flareGrade(1.5)).toBe('goodEarly');
    expect(flareGrade(-1.5)).toBe('goodLate');
    expect(flareGrade(3)).toBe('poorEarly');
    expect(flareGrade(-2.5)).toBe('poorLate');
  });
});

describe('LandingDetector', () => {
  it('reports a landing with the descent slope, peak g and rating', () => {
    const reports = run(approachFrames({ descentFpm: 180, peakG: 1.35, pitchRateAtContact: 0.4 }));
    expect(reports).toHaveLength(1);
    const report = reports[0]!;
    expect(report.touchdownRateFpm).toBeLessThan(-150);
    expect(report.touchdownRateFpm).toBeGreaterThan(-210);
    expect(report.rating).toBe('great');
    expect(report.peakG).toBeCloseTo(1.35, 2);
    expect(report.flare).toBe('veryGood');
    expect(report.indicatedRateFpm).toBe(-180);
    expect(report.bounces).toBe(0);
    expect(report.noseRateDegSec).toBeCloseTo(-1.5, 2);
    expect(report.floatSec).toBeGreaterThan(0);
  });

  it('never arms below 15 m, so taxiing produces no report', () => {
    const frames: SimFrame[] = [];
    for (let i = 0; i < 300; i++) {
      frames.push(
        frame({
          simT: i / 30,
          aglM: 0,
          onGroundAny: i % 40 !== 0,
          onGroundAll: true,
          groundspeedMs: 5,
        })
      );
    }
    expect(run(frames)).toHaveLength(0);
  });

  it('does not use paused frames in the slope window', () => {
    const frames = approachFrames({ descentFpm: 200 });
    const contactAt = frames.findIndex((f) => f.onGroundAny);
    const paused = frames.map((f, i) =>
      i > contactAt - 10 && i < contactAt ? { ...f, paused: true, aglM: 50 } : f
    );
    const [report] = run(paused);
    expect(report).toBeDefined();
    expect(report!.touchdownRateFpm).toBeLessThan(-150);
    expect(report!.touchdownRateFpm).toBeGreaterThan(-260);
  });

  it('ignores replay frames entirely', () => {
    const frames = approachFrames({ descentFpm: 300 }).map((f) => ({ ...f, replay: true }));
    expect(run(frames)).toHaveLength(0);
  });

  it('counts a lift-off within two seconds of contact as a bounce', () => {
    const hz = 30;
    const frames = approachFrames({ descentFpm: 400, rolloutSec: 0.5, hz });
    let t = frames[frames.length - 1]!.simT;
    const bounce: SimFrame[] = [];
    for (let i = 1; i <= 15; i++) {
      t += 1 / hz;
      bounce.push(frame({ simT: t, aglM: 0.6 - Math.abs(i - 8) * 0.07, onGroundAny: false }));
    }
    for (let i = 0; i <= 4 * hz; i++) {
      t += 1 / hz;
      bounce.push(frame({ simT: t, aglM: 0, onGroundAny: true, onGroundAll: i > hz }));
    }
    const reports = run([...frames, ...bounce]);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.bounces).toBe(1);
    expect(reports[0]!.bounceRatesFpm).toHaveLength(1);
    expect(reports[0]!.rating).toBe('hard');
  });

  it('closes a touch-and-go once the aircraft stays airborne', () => {
    const hz = 30;
    const frames = approachFrames({ descentFpm: 150, rolloutSec: 1, hz });
    let t = frames[frames.length - 1]!.simT;
    const climbOut: SimFrame[] = [];
    for (let i = 1; i <= 5 * hz; i++) {
      t += 1 / hz;
      climbOut.push(frame({ simT: t, aglM: i * 0.3, onGroundAny: false, vsFpm: 800 }));
    }
    const reports = run([...frames, ...climbOut]);
    expect(reports).toHaveLength(1);
    expect(reports[0]!.bounces).toBe(0);
  });

  it('re-arms after climbing back above 15 m for a second landing', () => {
    const first = approachFrames({ descentFpm: 200 });
    const second = approachFrames({
      descentFpm: 500,
      startSimT: first[first.length - 1]!.simT + 60,
    });
    const reports = run([...first, ...second]);
    expect(reports).toHaveLength(2);
    expect(reports[0]!.rating).toBe('great');
    expect(reports[1]!.rating).toBe('hard');
  });

  it('records lat, lon, heading and groundspeed at contact', () => {
    const [report] = run(approachFrames({ descentFpm: 100 }));
    expect(report!.lat).toBe(50);
    expect(report!.lon).toBe(8);
    expect(report!.headingDeg).toBe(90);
    expect(report!.groundspeedKt).toBeCloseTo(65 * 1.94384, 1);
    expect(report!.rating).toBe('butter');
  });
});
