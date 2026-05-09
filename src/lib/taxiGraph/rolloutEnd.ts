import type { Runway, RunwayEnd } from '@/types/apt';

/**
 * Given the runway end where the aircraft TOUCHES DOWN (e.g. `'18C'`), return
 * the OPPOSITE end of the same physical runway (`'36C'`) — that's where the
 * aircraft actually finishes its rollout before turning off onto a taxiway.
 *
 * Used by arrival taxi routing: the route should start at the rollout end,
 * not the touchdown threshold, otherwise the planned path forces the user
 * to "backtrack" the entire runway.
 */
export function getRolloutEnd(
  runways: ReadonlyArray<Runway> | undefined,
  landingEndName: string
): RunwayEnd | null {
  if (!runways) return null;
  for (const rwy of runways) {
    const matchIdx = rwy.ends.findIndex((e) => e.name === landingEndName);
    if (matchIdx === -1) continue;
    // ends is a [RunwayEnd, RunwayEnd] tuple, so the opposite is at 1 - idx.
    return rwy.ends[1 - matchIdx]!;
  }
  return null;
}
