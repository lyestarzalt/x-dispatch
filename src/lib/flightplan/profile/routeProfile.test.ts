import { describe, expect, it } from 'vitest';
import {
  CLASS_PERFORMANCE,
  type ProfileWaypointInput,
  computeRouteProfile,
  legSafeAltitudes,
  safeAltitudeFt,
} from './routeProfile';

/** Waypoints along the equator, one per entry, `nm` east of the first. */
const along = (ids: string[], nmEach: number, extra: Partial<ProfileWaypointInput>[] = []) =>
  ids.map((id, i): ProfileWaypointInput => ({
    id,
    latitude: 0,
    longitude: (i * nmEach) / 60,
    via: i === 0 ? 'ADEP' : i === ids.length - 1 ? 'ADES' : 'DRCT',
    ...extra[i],
  }));

const jet = CLASS_PERFORMANCE.jet;

describe('computeRouteProfile', () => {
  it('climbs at the class gradient to cruise, holds it, and descends to the destination', () => {
    // 300 NM at 30 000 ft: TOC at 30000 / climb gradient, TOD that far back from the end.
    const wps = along(['EGLL', 'A', 'B', 'EHAM'], 100);
    const profile = computeRouteProfile(wps, 30000, jet);
    const total = profile.totalDistanceNm; // a degree on the equator is 60.04 NM, not 60
    expect(profile.errors).toEqual([]);
    expect(profile.cruiseReached).toBe(true);
    expect(profile.tocDistanceNm).toBeCloseTo(30000 / jet.climbFtPerNm, 1);
    expect(profile.todDistanceNm).toBeCloseTo(total - 30000 / jet.descentFtPerNm, 1);
    // The input fixes keep their planned altitude: A and B are in cruise here.
    expect(profile.altitudesFt).toEqual([0, 30000, 30000, 0]);
    // TOC and TOD are inserted as points, in order, with their stage.
    const idents = profile.points.map((p) => p.ident);
    expect(idents).toEqual(['EGLL', 'TOC', 'A', 'B', 'TOD', 'EHAM']);
    const toc = profile.points.find((p) => p.isTopOfClimb)!;
    expect(toc.altitudeFt).toBe(30000);
    expect(toc.stage).toBe('CRZ');
    expect(profile.points[0]!.stage).toBe('CLB');
    expect(profile.points[profile.points.length - 1]!.stage).toBe('DSC');
    expect(profile.totalDistanceNm).toBeCloseTo(300, 0);
  });

  it('peaks where climb meets descent when the plan is too short to reach cruise', () => {
    const wps = along(['A', 'B'], 60);
    const profile = computeRouteProfile(wps, 30000, jet);
    expect(profile.cruiseReached).toBe(false);
    expect(profile.errors).toContain('cruiseNotReached');
    // climb * d = descent * (total - d)
    const d =
      (jet.descentFtPerNm * profile.totalDistanceNm) / (jet.climbFtPerNm + jet.descentFtPerNm);
    expect(profile.tocDistanceNm).toBeCloseTo(d, 1);
    expect(profile.todDistanceNm).toBeCloseTo(d, 1);
    const peak = profile.points.find((p) => p.isTopOfClimb)!;
    expect(peak.altitudeFt).toBeCloseTo(jet.climbFtPerNm * d, 0);
    expect(peak.isTopOfDescent).toBe(true);
  });

  it('honours an at-altitude restriction on a departure fix and climbs on from there', () => {
    const wps = along(['EGLL', 'SID1', 'B', 'EHAM'], 100, [
      {},
      {
        via: 'MODM1J',
        procedure: 'sid',
        constraint: { descriptor: '@', altitude1: 8000, altitude2: null },
      },
    ]);
    const profile = computeRouteProfile(wps, 30000, jet);
    expect(profile.altitudesFt[1]).toBe(8000);
    // From 8000 at the fix the remaining 22000 ft take 22000 / gradient NM.
    expect(profile.tocDistanceNm).toBeCloseTo(
      profile.distancesNm[1]! + 22000 / jet.climbFtPerNm,
      1
    );
  });

  it('keeps an at-or-below arrival restriction and descends from it', () => {
    const wps = along(['EGLL', 'A', 'STAR1', 'EHAM'], 100, [
      {},
      {},
      {
        via: 'MOLI2A',
        procedure: 'star',
        constraint: { descriptor: '-', altitude1: 10000, altitude2: null },
      },
    ]);
    const profile = computeRouteProfile(wps, 30000, jet);
    expect(profile.altitudesFt[2]).toBe(10000);
    // TOD sits where the cruise meets the descent into the 10000 ft fix.
    expect(profile.todDistanceNm).toBeCloseTo(
      profile.distancesNm[2]! - 20000 / jet.descentFtPerNm,
      1
    );
  });

  it('starts and ends at the airport elevations', () => {
    const wps = along(['LFLJ', 'A', 'LSGG'], 150, [
      { elevationFt: 6000 },
      {},
      { elevationFt: 1400 },
    ]);
    const profile = computeRouteProfile(wps, 30000, jet);
    expect(profile.altitudesFt[0]).toBe(6000);
    expect(profile.altitudesFt[2]).toBe(1400);
    expect(profile.tocDistanceNm).toBeCloseTo(24000 / jet.climbFtPerNm, 1);
  });

  it('reports a plan that is too short or a cruise that is too low instead of drawing one', () => {
    expect(computeRouteProfile(along(['A', 'B'], 0.2), 30000, jet).errors).toContain('tooShort');
    expect(computeRouteProfile(along(['A', 'B'], 100), 50, jet).errors).toContain('cruiseTooLow');
    expect(computeRouteProfile(along(['A'], 0), 30000, jet).errors).toContain('tooShort');
  });
});

describe('safe altitudes', () => {
  it('adds the 1000 ft ground buffer and rounds up to the next 500 ft', () => {
    expect(safeAltitudeFt(4321)).toBe(5500);
    expect(safeAltitudeFt(0)).toBe(1000);
    expect(safeAltitudeFt(4500)).toBe(5500);
  });

  it('gives one safe altitude per leg and the highest as the route minimum', () => {
    expect(legSafeAltitudes([120, 4321, 8900])).toEqual({
      perLegFt: [1500, 5500, 10000],
      routeFt: 10000,
    });
    expect(legSafeAltitudes([])).toEqual({ perLegFt: [], routeFt: null });
  });
});
