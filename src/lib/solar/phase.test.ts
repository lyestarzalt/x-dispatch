import * as SunCalc from 'suncalc';
import { describe, expect, it } from 'vitest';
import {
  DAYLIGHT_MIN_ALTITUDE,
  greatCirclePoint,
  phaseAt,
  phaseForAltitude,
  routePointAt,
  sampleRoute,
  sampleRouteAltitudes,
  solveTakeoff,
  sunEvents,
} from './phase';

const KJFK = { latitude: 40.6413, longitude: -73.7781 };
const EGLL = { latitude: 51.47, longitude: -0.4543 };
const WSSS = { latitude: 1.3644, longitude: 103.9915 };
const TROMSO = { latitude: 69.6833, longitude: 18.9189 };

const JUNE_21 = Date.UTC(2026, 5, 21, 0, 0);
const MARCH_20 = Date.UTC(2026, 2, 20, 0, 0);
const DEC_20 = Date.UTC(2026, 11, 20, 0, 0);
const MIN = 60_000;

describe('phaseForAltitude', () => {
  it('classifies each twilight boundary', () => {
    expect(phaseForAltitude(0.1)).toBe('day');
    expect(phaseForAltitude(0)).toBe('civil');
    expect(phaseForAltitude(-5.9)).toBe('civil');
    expect(phaseForAltitude(-6)).toBe('nautical');
    expect(phaseForAltitude(-12)).toBe('astro');
    expect(phaseForAltitude(-18)).toBe('night');
    expect(phaseForAltitude(-40)).toBe('night');
  });
});

describe('phaseAt', () => {
  it('is day at London noon and never fully dark on a London June night', () => {
    expect(phaseAt(Date.UTC(2026, 5, 21, 12), EGLL.latitude, EGLL.longitude)).toBe('day');
    expect(phaseAt(Date.UTC(2026, 5, 21, 1), EGLL.latitude, EGLL.longitude)).toBe('astro');
  });

  it('is night at Singapore midnight and day under the Tromsø midnight sun', () => {
    expect(phaseAt(Date.UTC(2026, 5, 20, 16), WSSS.latitude, WSSS.longitude)).toBe('night');
    expect(phaseAt(Date.UTC(2026, 5, 20, 23), TROMSO.latitude, TROMSO.longitude)).toBe('day');
  });
});

describe('greatCirclePoint', () => {
  it('returns the endpoints at f = 0 and f = 1', () => {
    const a = greatCirclePoint(KJFK, EGLL, 0);
    const b = greatCirclePoint(KJFK, EGLL, 1);
    expect(a.latitude).toBeCloseTo(KJFK.latitude, 6);
    expect(a.longitude).toBeCloseTo(KJFK.longitude, 6);
    expect(b.latitude).toBeCloseTo(EGLL.latitude, 6);
    expect(b.longitude).toBeCloseTo(EGLL.longitude, 6);
  });

  it('bows north of both endpoints halfway across the Atlantic', () => {
    const mid = greatCirclePoint(KJFK, EGLL, 0.5);
    expect(mid.latitude).toBeGreaterThan(EGLL.latitude);
    expect(mid.longitude).toBeCloseTo(-41.4, 0);
  });

  it('handles coincident points', () => {
    const p = greatCirclePoint(KJFK, KJFK, 0.3);
    expect(p).toEqual(KJFK);
  });
});

describe('routePointAt', () => {
  const dogleg = [
    { latitude: 0, longitude: 0 },
    { latitude: 0, longitude: 10 },
    { latitude: 10, longitude: 10 },
  ];

  it('follows the legs by distance rather than cutting the corner', () => {
    const mid = routePointAt(dogleg, 0.5);
    expect(mid.latitude).toBeCloseTo(0, 3);
    expect(mid.longitude).toBeCloseTo(10, 3);
    const quarter = routePointAt(dogleg, 0.25);
    expect(quarter.latitude).toBeCloseTo(0, 3);
    expect(quarter.longitude).toBeCloseTo(5, 3);
  });

  it('clamps outside [0, 1] and copes with a single point', () => {
    expect(routePointAt(dogleg, -1)).toEqual(dogleg[0]);
    const end = routePointAt(dogleg, 2);
    expect(end.latitude).toBeCloseTo(10, 6);
    expect(end.longitude).toBeCloseTo(10, 6);
    expect(routePointAt([KJFK], 0.5)).toEqual(KJFK);
  });
});

describe('sampleRoute', () => {
  it('is all day for a short Singapore hop around local noon', () => {
    const from = Date.UTC(2026, 5, 21, 3, 30);
    const phases = sampleRoute(
      [WSSS, { latitude: 2.7456, longitude: 101.7099 }],
      from,
      from + 45 * MIN,
      8
    );
    expect(phases).toHaveLength(8);
    expect(new Set(phases)).toEqual(new Set(['day']));
  });

  it('runs from day through night into the London dawn on an evening eastbound crossing', () => {
    // 18:00 in New York, landing at 05:00 UTC, an hour before London sunrise.
    const from = Date.UTC(2026, 2, 20, 22, 0);
    const phases = sampleRoute([KJFK, EGLL], from, from + 7 * 60 * MIN, 20);
    expect(phases[0]).toBe('day');
    expect(phases).toContain('night');
    expect(phases[phases.length - 1]).not.toBe('day');
  });
});

describe('sunEvents', () => {
  it('matches suncalc for London on the March equinox', () => {
    const events = sunEvents(Date.UTC(2026, 2, 20, 12), EGLL.latitude, EGLL.longitude);
    const ref = SunCalc.getTimes(
      new Date(Date.UTC(2026, 2, 20, 12)),
      EGLL.latitude,
      EGLL.longitude
    );
    expect(events.sunriseMs).toBe(ref.sunrise?.getTime());
    expect(events.sunsetMs).toBe(ref.sunset?.getTime());
  });

  it('reports no events under the midnight sun', () => {
    const events = sunEvents(JUNE_21, TROMSO.latitude, TROMSO.longitude);
    expect(events.sunriseMs).toBeNull();
    expect(events.sunsetMs).toBeNull();
  });
});

describe('solveTakeoff', () => {
  const atlantic = { points: [KJFK, EGLL], eteMinutes: 7 * 60 };

  it('lands at London sunset for a dusk arrival', () => {
    const takeoff = solveTakeoff('duskArrival', { ...atlantic, fromMs: MARCH_20 });
    expect(takeoff).not.toBeNull();
    const landing = takeoff! + atlantic.eteMinutes * MIN;
    const { sunsetMs } = sunEvents(landing, EGLL.latitude, EGLL.longitude);
    expect(Math.abs(landing - sunsetMs!)).toBeLessThanOrEqual(5 * MIN);
    expect(takeoff).toBeGreaterThanOrEqual(MARCH_20);
  });

  it('lands at London sunrise for a dawn arrival', () => {
    const takeoff = solveTakeoff('dawnArrival', { ...atlantic, fromMs: MARCH_20 });
    const landing = takeoff! + atlantic.eteMinutes * MIN;
    const { sunriseMs } = sunEvents(landing, EGLL.latitude, EGLL.longitude);
    expect(Math.abs(landing - sunriseMs!)).toBeLessThanOrEqual(5 * MIN);
  });

  it('takes off at New York sunset for a dusk departure', () => {
    const takeoff = solveTakeoff('duskDeparture', { ...atlantic, fromMs: MARCH_20 });
    const { sunsetMs } = sunEvents(takeoff!, KJFK.latitude, KJFK.longitude);
    expect(Math.abs(takeoff! - sunsetMs!)).toBeLessThanOrEqual(5 * MIN);
  });

  it('finds the first window with the sun well up the whole way, and the first all-dark window', () => {
    // Seven hours eastbound in March cannot keep the sun 6° up from New York to London.
    expect(solveTakeoff('daylight', { ...atlantic, fromMs: MARCH_20 })).toBeNull();

    const KORD = { latitude: 41.9742, longitude: -87.9073 };
    const short = { points: [KJFK, KORD], eteMinutes: 150 };
    const day = solveTakeoff('daylight', { ...short, fromMs: MARCH_20 });
    expect(day).not.toBeNull();
    const ete = short.eteMinutes * MIN;
    const alts = sampleRouteAltitudes(short.points, day!, day! + ete, 40);
    expect(alts.every((alt) => alt >= DAYLIGHT_MIN_ALTITUDE)).toBe(true);
    // Five minutes earlier must not satisfy it, or it was not the first.
    const earlier = sampleRouteAltitudes(short.points, day! - 5 * MIN, day! - 5 * MIN + ete, 40);
    expect(earlier.every((alt) => alt >= DAYLIGHT_MIN_ALTITUDE)).toBe(false);

    // Eastbound in March the night is too short for seven hours; December has room.
    expect(solveTakeoff('night', { ...atlantic, fromMs: MARCH_20 })).toBeNull();
    const night = solveTakeoff('night', { ...atlantic, fromMs: DEC_20 });
    expect(night).not.toBeNull();
    const nightPhases = sampleRoute(
      atlantic.points,
      night!,
      night! + atlantic.eteMinutes * MIN,
      40
    );
    expect(nightPhases.every((p) => p !== 'day' && p !== 'civil')).toBe(true);
  });

  it('gives the same answer when asked again a minute later', () => {
    const first = solveTakeoff('duskArrival', { ...atlantic, fromMs: MARCH_20 + 3 * MIN });
    const later = solveTakeoff('duskArrival', { ...atlantic, fromMs: MARCH_20 + 4 * MIN });
    expect(first).not.toBeNull();
    expect(later).toBe(first);
    expect(first! % (5 * MIN)).toBe(0);
  });

  it('returns null when the goal cannot happen within the horizon', () => {
    const polar = { points: [TROMSO, { latitude: 70.0, longitude: 20.0 }], eteMinutes: 30 };
    expect(solveTakeoff('night', { ...polar, fromMs: JUNE_21 })).toBeNull();
    expect(solveTakeoff('duskArrival', { ...polar, fromMs: JUNE_21 })).toBeNull();
  });
});
