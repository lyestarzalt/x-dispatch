import type { FMSFlightPlan, FMSWaypoint } from '@/types/fms';

const FMS_VERSION = 1100;

function runwayField(runway: string | undefined): string | undefined {
  if (!runway) return undefined;
  const bare = runway.toUpperCase().replace(/^RW/, '');
  return `RW${bare}`;
}

function waypointLine(wp: FMSWaypoint): string {
  return [
    wp.type,
    wp.id,
    wp.via,
    wp.altitude.toFixed(6),
    wp.latitude.toFixed(6),
    wp.longitude.toFixed(6),
  ].join(' ');
}

/** X-Plane 11/12 FMS v1100 text. Optional header lines are omitted rather than left blank. */
export function serializeFms(plan: FMSFlightPlan): string {
  // The spec makes CYCLE mandatory as line three; the parser copes with a missing one, so it is
  // only written when known.
  const lines: string[] = ['I', `${FMS_VERSION} Version`];
  if (plan.cycle) lines.push(`CYCLE ${plan.cycle}`);
  lines.push(`ADEP ${plan.departure.icao}`);
  const depRwy = runwayField(plan.departure.runway);
  if (depRwy) lines.push(`DEPRWY ${depRwy}`);
  if (plan.departure.sid) lines.push(`SID ${plan.departure.sid}`);
  if (plan.departure.sidTransition) lines.push(`SIDTRANS ${plan.departure.sidTransition}`);
  lines.push(`ADES ${plan.arrival.icao}`);
  const desRwy = runwayField(plan.arrival.runway);
  if (desRwy) lines.push(`DESRWY ${desRwy}`);
  // X-Plane rejects a STAR or approach without DESRWY, so without a runway they are left out.
  if (desRwy) {
    if (plan.arrival.star) lines.push(`STAR ${plan.arrival.star}`);
    if (plan.arrival.starTransition) lines.push(`STARTRANS ${plan.arrival.starTransition}`);
    if (plan.arrival.approach) lines.push(`APP ${plan.arrival.approach}`);
    if (plan.arrival.approachTransition) {
      lines.push(`APPTRANS ${plan.arrival.approachTransition}`);
    }
  }
  lines.push(`NUMENR ${plan.waypoints.length}`);
  for (const wp of plan.waypoints) lines.push(waypointLine(wp));
  return `${lines.join('\n')}\n`;
}

/** Safe file stem for Output/FMS plans, for example EHAMEDDF or EHAM-EDDF01. */
export function fmsFileStem(departureIcao: string, arrivalIcao: string, suffix = ''): string {
  const clean = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return `${clean(departureIcao)}${clean(arrivalIcao)}${suffix}`;
}
