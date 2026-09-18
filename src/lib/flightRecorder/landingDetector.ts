import { type FlareGrade, type LandingReport, landingRating } from '@/types/flightRecorder';
import type { SimFrame } from './frames';

/**
 * Touchdown analysis in the manner of LandingRate for FlyWithLua, so the
 * numbers line up with what pilots already compare against:
 *
 * - arm above 15 m, ignore replays and paused frames
 * - descent rate is the slope of height-above-ground over the last half
 *   second before first contact, not the instrument VSI
 * - flare grade from body pitch rate at contact, nose rate when all wheels
 *   are down, float time from 15 m to contact
 *
 * Differences: peak g is the maximum in the second after contact (the
 * original averages g before contact, which reads about 1.0 every time),
 * and lift-offs within two seconds of contact are counted as bounces.
 */

const ARM_HEIGHT_M = 15;
const SLOPE_WINDOW_S = 0.5;
const PEAK_G_WINDOW_S = 1;
const BOUNCE_WINDOW_S = 2;
const CLOSE_AFTER_S = 3;
const MS_TO_FPM = 196.8504;
const MS_TO_KT = 1.94384;

type DetectorState = 'standby' | 'armed' | 'contact' | 'rollout';

interface WindowSample {
  t: number;
  aglM: number;
}

export function flareGrade(pitchRateDegSec: number): FlareGrade {
  const magnitude = Math.abs(pitchRateDegSec);
  if (magnitude <= 1) return 'veryGood';
  const late = pitchRateDegSec < 0;
  if (magnitude <= 2) return late ? 'goodLate' : 'goodEarly';
  return late ? 'poorLate' : 'poorEarly';
}

/** Least-squares slope of height over time, in feet per minute. */
export function descentRateFpm(samples: readonly WindowSample[]): number | null {
  if (samples.length < 2) return null;
  const n = samples.length;
  let sumT = 0;
  let sumH = 0;
  for (const s of samples) {
    sumT += s.t;
    sumH += s.aglM;
  }
  const meanT = sumT / n;
  const meanH = sumH / n;
  let num = 0;
  let den = 0;
  for (const s of samples) {
    const dt = s.t - meanT;
    num += dt * (s.aglM - meanH);
    den += dt * dt;
  }
  if (den === 0) return null;
  return (num / den) * MS_TO_FPM;
}

export class LandingDetector {
  private state: DetectorState = 'standby';
  private window: WindowSample[] = [];
  private prev: SimFrame | null = null;
  private floatStartT: number | null = null;
  private report: LandingReport | null = null;
  private lastContactT = 0;
  private airborneSinceT: number | null = null;

  get isArmed(): boolean {
    return this.state === 'armed';
  }

  /** Feed one frame. Returns a finished report when a landing has settled. */
  push(frame: SimFrame): LandingReport | null {
    if (frame.replay) {
      this.reset();
      this.prev = frame;
      return null;
    }
    if (frame.paused) return null;

    let finished: LandingReport | null = null;
    const prev = this.prev;
    this.prev = frame;

    if (frame.aglM > ARM_HEIGHT_M && this.state !== 'armed') {
      finished = this.state === 'standby' ? null : this.close();
      this.arm();
    }

    this.window.push({ t: frame.simT, aglM: frame.aglM });
    while (this.window.length > 1 && frame.simT - this.window[0]!.t > SLOPE_WINDOW_S) {
      this.window.shift();
    }

    if (this.state === 'armed' && frame.aglM <= ARM_HEIGHT_M && this.floatStartT === null) {
      this.floatStartT = frame.simT;
    }

    const touchedDown = prev !== null && !prev.onGroundAny && frame.onGroundAny;
    const liftedOff = prev !== null && prev.onGroundAny && !frame.onGroundAny;
    const noseDown = prev !== null && !prev.onGroundAll && frame.onGroundAll;

    if (this.state === 'armed' && touchedDown) {
      this.report = this.buildReport(frame, prev);
      this.state = 'contact';
      this.lastContactT = frame.simT;
      this.airborneSinceT = null;
      return finished;
    }

    if (this.state === 'contact' || this.state === 'rollout') {
      const report = this.report!;
      if (frame.simT - this.lastContactT <= PEAK_G_WINDOW_S) {
        report.peakG = Math.max(report.peakG, frame.gNormal);
      }
      if (liftedOff) {
        this.airborneSinceT = frame.simT;
      }
      if (touchedDown && this.airborneSinceT !== null) {
        report.bounces += 1;
        report.bounceRatesFpm.push(this.contactRate(prev));
        this.lastContactT = frame.simT;
        this.airborneSinceT = null;
      }
      if (noseDown && report.noseRateDegSec === null) {
        report.noseRateDegSec = frame.pitchRateDegSec;
        this.state = 'rollout';
      }
      const bounceExpired =
        this.airborneSinceT !== null && frame.simT - this.airborneSinceT > BOUNCE_WINDOW_S;
      const settled = frame.onGroundAny && frame.simT - this.lastContactT >= CLOSE_AFTER_S;
      if (bounceExpired || settled) {
        return this.close();
      }
    }

    return finished;
  }

  private arm(): void {
    this.state = 'armed';
    this.window = [];
    this.floatStartT = null;
    this.report = null;
    this.airborneSinceT = null;
  }

  private reset(): void {
    this.state = 'standby';
    this.window = [];
    this.floatStartT = null;
    this.report = null;
    this.airborneSinceT = null;
  }

  private close(): LandingReport | null {
    const report = this.report;
    this.state = 'standby';
    this.report = null;
    this.airborneSinceT = null;
    return report;
  }

  private contactRate(lastAirborne: SimFrame | null): number {
    const slope = descentRateFpm(this.window);
    const rate = slope ?? lastAirborne?.vsFpm ?? 0;
    return Math.min(0, Math.round(rate));
  }

  private buildReport(frame: SimFrame, lastAirborne: SimFrame | null): LandingReport {
    const touchdownRateFpm = this.contactRate(lastAirborne);
    return {
      at: frame.wallT,
      lat: frame.lat,
      lon: frame.lon,
      headingDeg: frame.headingDeg,
      groundspeedKt: frame.groundspeedMs * MS_TO_KT,
      touchdownRateFpm,
      indicatedRateFpm: Math.round(lastAirborne?.vsFpm ?? frame.vsFpm),
      peakG: frame.gNormal,
      pitchDeg: frame.pitchDeg,
      rollDeg: frame.rollDeg,
      pitchRateDegSec: frame.pitchRateDegSec,
      flare: flareGrade(frame.pitchRateDegSec),
      noseRateDegSec: frame.onGroundAll ? frame.pitchRateDegSec : null,
      floatSec: this.floatStartT === null ? 0 : frame.simT - this.floatStartT,
      bounces: 0,
      bounceRatesFpm: [],
      rating: landingRating(touchdownRateFpm),
      runway: null,
    };
  }
}
