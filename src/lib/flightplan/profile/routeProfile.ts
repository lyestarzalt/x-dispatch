/**
 * The planned vertical profile of a route: climb at a fixed gradient to the cruise altitude,
 * hold it, descend at a fixed gradient to the destination, bent by any published altitude
 * restrictions on procedure fixes. Top of climb and top of descent are where the climb and
 * descent lines meet the cruise; when they meet each other first the plan never reaches
 * cruise and peaks there instead. Safe altitudes come from the terrain under each leg plus a
 * fixed buffer, rounded up.
 */
import type { LatLon } from '@/lib/flightplan/builder/geometry';
import { bearingDeg, destinationPoint, greatCircleNm } from '@/lib/flightplan/builder/geometry';
import type { RangeRingCategory } from '@/types/layers';
import type { AltitudeConstraint } from '@/types/navigation';

export interface ProfileWaypointInput extends LatLon {
  id: string;
  via: string;
  /** Which procedure the fix belongs to, when any. */
  procedure?: 'sid' | 'star' | 'approach';
  /** Published altitude restriction, feet. */
  constraint?: AltitudeConstraint | null;
  /** Field elevation for the departure and destination airports, feet. */
  elevationFt?: number;
}

/** Climb and descent gradients plus speeds for a class of aircraft. */
export interface ProfilePerformance {
  climbFtPerNm: number;
  descentFtPerNm: number;
  climbKt: number;
  cruiseKt: number;
  descentKt: number;
}

/**
 * Class defaults until a real performance profile exists. Gradients are vertical speed x 60 /
 * speed, the reference's own formula, with typical figures per class.
 */
export const CLASS_PERFORMANCE: Record<RangeRingCategory, ProfilePerformance> = {
  jet: { climbFtPerNm: 400, descentFtPerNm: 320, climbKt: 300, cruiseKt: 450, descentKt: 300 },
  turboprop: {
    climbFtPerNm: 450,
    descentFtPerNm: 360,
    climbKt: 200,
    cruiseKt: 280,
    descentKt: 200,
  },
  prop: { climbFtPerNm: 300, descentFtPerNm: 270, climbKt: 100, cruiseKt: 130, descentKt: 110 },
};

export type ProfileStage = 'CLB' | 'CRZ' | 'DSC';
export type ProfileError = 'tooShort' | 'cruiseTooLow' | 'cruiseNotReached';

export interface ProfilePoint extends LatLon {
  distanceNm: number;
  altitudeFt: number;
  ident: string;
  stage: ProfileStage;
  isTopOfClimb: boolean;
  isTopOfDescent: boolean;
  /** Index into the input waypoints, or null for an inserted TOC/TOD point. */
  waypointIndex: number | null;
}

export interface RouteProfile {
  points: ProfilePoint[];
  /** Planned altitude at each input waypoint, feet. */
  altitudesFt: number[];
  /** Cumulative distance to each input waypoint, NM. */
  distancesNm: number[];
  tocDistanceNm: number | null;
  todDistanceNm: number | null;
  totalDistanceNm: number;
  cruiseReached: boolean;
  errors: ProfileError[];
}

const MIN_PLAN_NM = 0.5;
const MIN_CRUISE_FT = 100;
/** Ground clearance added to the highest terrain under a leg. */
const GROUND_BUFFER_FT = 1000;
const ROUND_BUFFER_FT = 500;

/** A restriction applied to a computed altitude, the way the reference's profile does it. */
function applyRestriction(altitudeFt: number, c: AltitudeConstraint | null | undefined): number {
  if (!c || c.altitude1 === null) return altitudeFt;
  switch (c.descriptor) {
    case '@':
      return c.altitude1;
    case '+':
      return Math.max(altitudeFt, c.altitude1);
    case '-':
      return Math.min(altitudeFt, c.altitude1);
    case 'B': {
      // altitude1 is the upper bound, altitude2 the lower one.
      const lower = c.altitude2 ?? c.altitude1;
      return Math.min(c.altitude1, Math.max(lower, altitudeFt));
    }
    default:
      return altitudeFt;
  }
}

/** Where, along the leg from `a` to `b`, a line rising from `altA` to `altB` crosses `target`. */
function crossing(dA: number, altA: number, dB: number, altB: number, target: number): number {
  if (altB === altA) return dA;
  return dA + ((target - altA) / (altB - altA)) * (dB - dA);
}

function interpolate(a: LatLon, b: LatLon, fraction: number): LatLon {
  const legNm = greatCircleNm(a, b);
  if (legNm < 1e-6) return a;
  return destinationPoint(a, bearingDeg(a, b), legNm * fraction);
}

export function computeRouteProfile(
  waypoints: ProfileWaypointInput[],
  cruiseAltitudeFt: number,
  perf: ProfilePerformance
): RouteProfile {
  const n = waypoints.length;
  const distancesNm: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    if (i > 0) total += greatCircleNm(waypoints[i - 1]!, waypoints[i]!);
    distancesNm.push(total);
  }

  const errors: ProfileError[] = [];
  if (n < 2 || total < MIN_PLAN_NM) errors.push('tooShort');
  if (cruiseAltitudeFt < MIN_CRUISE_FT) errors.push('cruiseTooLow');
  const empty: RouteProfile = {
    points: [],
    altitudesFt: [],
    distancesNm,
    tocDistanceNm: null,
    todDistanceNm: null,
    totalDistanceNm: total,
    cruiseReached: false,
    errors,
  };
  if (errors.length > 0) return empty;

  // Climb forward from the departure elevation; the uncorrected line finds the TOC later.
  const climb: number[] = [];
  const climbRaw: number[] = [];
  const departureElev = waypoints[0]!.elevationFt ?? 0;
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      climb.push(departureElev);
      climbRaw.push(departureElev);
      continue;
    }
    const leg = distancesNm[i]! - distancesNm[i - 1]!;
    const raw = climb[i - 1]! + leg * perf.climbFtPerNm;
    climbRaw.push(raw);
    climb.push(applyRestriction(Math.min(cruiseAltitudeFt, raw), waypoints[i]!.constraint));
  }

  // Descend backwards from the destination elevation.
  const descent: number[] = new Array<number>(n);
  const descentRaw: number[] = new Array<number>(n);
  const destinationElev = waypoints[n - 1]!.elevationFt ?? 0;
  for (let i = n - 1; i >= 0; i--) {
    if (i === n - 1) {
      descent[i] = destinationElev;
      descentRaw[i] = destinationElev;
      continue;
    }
    const leg = distancesNm[i + 1]! - distancesNm[i]!;
    const raw = descent[i + 1]! + leg * perf.descentFtPerNm;
    descentRaw[i] = raw;
    descent[i] = applyRestriction(Math.min(cruiseAltitudeFt, raw), waypoints[i]!.constraint);
  }

  const altitudesFt = climb.map((c, i) => Math.min(c, descent[i]!));

  // TOC: first leg whose climb reaches the cruise and is allowed to hold it there. TOD: last
  // leg whose descent leaves it. A fix held below cruise by a restriction is not a crossing.
  let toc: number | null = null;
  for (let i = 1; i < n && toc === null; i++) {
    if (climb[i - 1]! < cruiseAltitudeFt && climb[i]! >= cruiseAltitudeFt) {
      toc = crossing(
        distancesNm[i - 1]!,
        climb[i - 1]!,
        distancesNm[i]!,
        climbRaw[i]!,
        cruiseAltitudeFt
      );
    }
  }
  let tod: number | null = null;
  for (let i = n - 2; i >= 0 && tod === null; i--) {
    if (descent[i + 1]! < cruiseAltitudeFt && descent[i]! >= cruiseAltitudeFt) {
      tod = crossing(
        distancesNm[i + 1]!,
        descent[i + 1]!,
        distancesNm[i]!,
        descentRaw[i]!,
        cruiseAltitudeFt
      );
    }
  }

  let cruiseReached = toc !== null && tod !== null && toc <= tod;
  let peakAlt = cruiseAltitudeFt;
  if (!cruiseReached) {
    // The climb and descent lines meet below cruise: find the leg where the minimum switches.
    errors.push('cruiseNotReached');
    let peakDist = distancesNm[0]!;
    for (let i = 1; i < n; i++) {
      const dA = distancesNm[i - 1]!;
      const dB = distancesNm[i]!;
      const cA = climb[i - 1]!;
      const cB = climbRaw[i]!;
      const sA = descentRaw[i - 1]!;
      const sB = descent[i]!;
      if (cA <= sA && cB >= sB) {
        const denom = cB - cA - (sB - sA);
        const t = denom === 0 ? 0 : (sA - cA) / denom;
        peakDist = dA + t * (dB - dA);
        peakAlt = cA + t * (cB - cA);
        break;
      }
    }
    toc = peakDist;
    tod = peakDist;
    cruiseReached = false;
  }

  const stageAt = (d: number): ProfileStage => {
    if (toc !== null && d < toc) return 'CLB';
    if (tod !== null && d > tod) return 'DSC';
    return 'CRZ';
  };

  const points: ProfilePoint[] = [];
  const pushMarker = (dist: number, alt: number, ident: string, isToc: boolean, isTod: boolean) => {
    for (let i = 1; i < n; i++) {
      if (dist >= distancesNm[i - 1]! && dist <= distancesNm[i]!) {
        const legNm = distancesNm[i]! - distancesNm[i - 1]!;
        const f = legNm === 0 ? 0 : (dist - distancesNm[i - 1]!) / legNm;
        const pos = interpolate(waypoints[i - 1]!, waypoints[i]!, f);
        points.push({
          ...pos,
          distanceNm: dist,
          altitudeFt: alt,
          ident,
          stage: 'CRZ',
          isTopOfClimb: isToc,
          isTopOfDescent: isTod,
          waypointIndex: null,
        });
        return;
      }
    }
  };
  for (let i = 0; i < n; i++) {
    const d = distancesNm[i]!;
    const prev = i > 0 ? distancesNm[i - 1]! : -1;
    if (toc !== null && toc > prev && toc < d) {
      pushMarker(toc, peakAlt, cruiseReached ? 'TOC' : 'TOC/TOD', true, !cruiseReached);
    }
    if (cruiseReached && tod !== null && tod > prev && tod < d && tod !== toc) {
      pushMarker(tod, cruiseAltitudeFt, 'TOD', false, true);
    }
    const wp = waypoints[i]!;
    points.push({
      latitude: wp.latitude,
      longitude: wp.longitude,
      distanceNm: d,
      altitudeFt: altitudesFt[i]!,
      ident: wp.id,
      stage: stageAt(d),
      isTopOfClimb: false,
      isTopOfDescent: false,
      waypointIndex: i,
    });
  }
  // Markers sit between a TOC/TOD pair's neighbours in distance order already; make sure.
  points.sort((a, b) => a.distanceNm - b.distanceNm);

  return {
    points,
    altitudesFt,
    distancesNm,
    tocDistanceNm: toc,
    todDistanceNm: tod,
    totalDistanceNm: total,
    cruiseReached,
    errors,
  };
}

/** Highest terrain plus the ground buffer, rounded up to the next 500 ft. */
export function safeAltitudeFt(maxElevationFt: number): number {
  return Math.ceil((maxElevationFt + GROUND_BUFFER_FT) / ROUND_BUFFER_FT) * ROUND_BUFFER_FT;
}

/** Safe altitude per leg from the highest terrain under each, and the route's minimum. */
export function legSafeAltitudes(maxElevationPerLegFt: number[]): {
  perLegFt: number[];
  routeFt: number | null;
} {
  const perLegFt = maxElevationPerLegFt.map(safeAltitudeFt);
  return { perLegFt, routeFt: perLegFt.length > 0 ? Math.max(...perLegFt) : null };
}
