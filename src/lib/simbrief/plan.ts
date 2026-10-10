import type { EnrichedFlightPlan, EnrichedWaypoint, FMSWaypointType } from '@/types/fms';
import type { SimBriefFix, SimBriefOFP } from '@/types/simbrief';
import { primaryAlternate } from './ofp';

/**
 * A SimBrief OFP as the plan the map, the flight plan bar and the profile draw. It takes the
 * same shape the planner produces, so the route line gets the planner's leg colours (SID,
 * STAR, airway, oceanic track) and chips without any SimBrief-specific drawing code:
 *
 * - the departure and arrival airports bracket the fixes as `ADEP` / `ADES` waypoints;
 * - `DCT` legs become `DRCT`, the FMS spelling the layer already knows;
 * - the SID and STAR fixes SimBrief flags with `is_sid_star` become `procedurePaths`,
 *   keyed by the procedure name each fix carries in `via_airway`.
 *
 * Positions and altitudes stay exactly as SimBrief published them on its own AIRAC cycle.
 */
export function enrichedPlanFromOfp(ofp: SimBriefOFP): EnrichedFlightPlan {
  const { origin, destination, general } = ofp;
  const sid = general.sid_ident || undefined;
  const star = general.star_ident || undefined;

  const waypoints: EnrichedWaypoint[] = [airportWaypoint(origin.icao_code, 'ADEP', origin, 'CLB')];
  for (const fix of ofp.navlog) {
    if (
      fix.type === 'apt' &&
      (fix.ident === origin.icao_code || fix.ident === destination.icao_code)
    ) {
      continue;
    }
    waypoints.push({
      type: fixType(fix.type),
      id: fix.ident,
      via: !fix.via_airway || fix.via_airway === 'DCT' ? 'DRCT' : fix.via_airway,
      altitude: parseInt(fix.altitude_feet, 10) || 0,
      latitude: parseFloat(fix.pos_lat),
      longitude: parseFloat(fix.pos_long),
      found: true,
      stage: stageOf(fix.stage),
      frequency: fix.frequency ? parseFloat(fix.frequency) || undefined : undefined,
    });
  }
  waypoints.push(airportWaypoint(destination.icao_code, 'ADES', destination, 'DSC'));

  const alternate = primaryAlternate(ofp);

  return {
    version: 1100,
    cycle: ofp.params.airac || undefined,
    departure: {
      icao: origin.icao_code,
      runway: origin.plan_rwy || undefined,
      sid,
      sidTransition: general.sid_trans || undefined,
    },
    arrival: {
      icao: destination.icao_code,
      runway: destination.plan_rwy || undefined,
      star,
      starTransition: general.star_trans || undefined,
    },
    waypoints,
    alternate: alternate
      ? {
          icao: alternate.icao_code,
          latitude: parseFloat(alternate.pos_lat),
          longitude: parseFloat(alternate.pos_long),
        }
      : undefined,
    procedurePaths: procedurePathsFromNavlog(ofp.navlog, sid, star),
    resolution: {
      total: waypoints.length,
      found: waypoints.length,
      notFound: 0,
      cycleMatch: true,
    },
  };
}

/**
 * One path per run of consecutive procedure fixes sharing a `via_airway`. SimBrief names the
 * SID and STAR there, so the run's name decides its kind; a run that matches neither is a SID
 * when it opens the navlog and a STAR otherwise.
 */
export function procedurePathsFromNavlog(
  navlog: SimBriefFix[],
  sid: string | undefined,
  star: string | undefined
): NonNullable<EnrichedFlightPlan['procedurePaths']> {
  const paths: NonNullable<EnrichedFlightPlan['procedurePaths']> = [];
  let current: (typeof paths)[number] | null = null;
  let sawEnroute = false;

  for (const fix of navlog) {
    const inProcedure = fix.is_sid_star === '1' && !!fix.via_airway && fix.via_airway !== 'DCT';
    if (!inProcedure) {
      current = null;
      sawEnroute = true;
      continue;
    }
    if (!current || current.via !== fix.via_airway) {
      const kind =
        fix.via_airway === sid
          ? 'sid'
          : fix.via_airway === star
            ? 'star'
            : sawEnroute
              ? 'star'
              : 'sid';
      current = { via: fix.via_airway, kind, path: [] };
      paths.push(current);
    }
    current.path.push({ latitude: parseFloat(fix.pos_lat), longitude: parseFloat(fix.pos_long) });
  }

  return paths.filter((p) => p.path.length > 1);
}

function airportWaypoint(
  icao: string,
  via: 'ADEP' | 'ADES',
  airport: { pos_lat: string; pos_long: string; elevation: string },
  stage: EnrichedWaypoint['stage']
): EnrichedWaypoint {
  return {
    type: 1,
    id: icao,
    via,
    altitude: parseInt(airport.elevation, 10) || 0,
    latitude: parseFloat(airport.pos_lat),
    longitude: parseFloat(airport.pos_long),
    found: true,
    stage,
  };
}

function fixType(type: string): FMSWaypointType {
  switch (type) {
    case 'apt':
      return 1;
    case 'ndb':
      return 2;
    case 'vor':
      return 3;
    case 'ltlg':
      return 28;
    default:
      return 11;
  }
}

function stageOf(stage: string): EnrichedWaypoint['stage'] {
  return stage === 'CLB' || stage === 'CRZ' || stage === 'DSC' ? stage : undefined;
}
