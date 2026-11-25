import type { FixTypeCode, Navaid, ResolvedProcedureWaypoint } from '@/types/navigation';

/** Fix types that are a radio navaid themselves. CIFP files every VOR and NDB under `D`. */
const NAVAID_FIX_TYPES = new Set<FixTypeCode>(['D', 'V', 'N']);

/**
 * The radio navaids a procedure uses, out of the ones loaded around the airport: every leg fix
 * that is itself a navaid, and every leg's recommended navaid (the station a course, a DME arc
 * or a holding fix is measured from). Matched on ident and ICAO region, in the order of
 * `navaids`, so a beacon and a DME sharing an ident both come back. A navaid record keeps that
 * region in `country`; its `region` is the terminal area (`ENRT` for an enroute station). A navaid outside the loaded area is
 * simply not found.
 */
export function procedureNavaids(
  waypoints: readonly ResolvedProcedureWaypoint[],
  navaids: readonly Navaid[]
): Navaid[] {
  const wanted = new Set<string>();
  for (const wp of waypoints) {
    if (NAVAID_FIX_TYPES.has(wp.fixType)) wanted.add(`${wp.fixId}/${wp.fixRegion}`);
    if (wp.recNavaid) wanted.add(`${wp.recNavaid}/${wp.recNavaidRegion ?? ''}`);
  }
  if (wanted.size === 0) return [];
  return navaids.filter((n) => wanted.has(`${n.id}/${n.country}`));
}
