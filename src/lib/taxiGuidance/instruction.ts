import type { RouteProgress } from './progress';
import type { GuidanceEvent } from './types';

/** A turn or crossing stays on screen until the aircraft is this far past it. */
const PASSED_M = 10;
/** Past the hold line by this much, the aircraft is lining up: the hold instruction is done. */
const LINED_UP_M = 30;
/** The following instruction is shown as "then" only when it comes this soon after the next one. */
const THEN_WINDOW_M = 300;
/** Further from the route than this, the pilot is told they left it. */
export const OFF_ROUTE_M = 40;
/**
 * A gate is often well off the taxi network, beside the route's first leg.
 * Before joining the route, or after leaving its end for the stand, being this
 * far away is still normal.
 */
const JOIN_RADIUS_M = 300;
const END_RADIUS_M = 150;
/** Close enough to the route's end to call the stand reached. */
const ARRIVED_M = 15;
/** Closer than this, the next instruction is for now; a hold short only once at the line. */
const NOW_M = 16;
const AT_HOLD_M = 6;

export interface GuidanceView {
  offRoute: boolean;
  arrived: boolean;
  next: { event: GuidanceEvent; distance: number; now: boolean } | null;
  then: GuidanceEvent | null;
}

export function guidanceView(
  events: GuidanceEvent[],
  progress: RouteProgress,
  total: number
): GuidanceView {
  const { along, lateral } = progress;
  const beforeStart = !progress.joined && lateral <= JOIN_RADIUS_M;
  const pastEnd = along >= total - 0.5 && lateral <= END_RADIUS_M;
  const offRoute = lateral > OFF_ROUTE_M && !beforeStart && !pastEnd;

  const hasArrive = events.some((e) => e.kind === 'arrive');
  const arrived = hasArrive && !offRoute && along >= total - ARRIVED_M;

  // Arrive ends the route and stays up once reached; hold short stays until lined up.
  const index = events.findIndex(
    (e) => e.kind === 'arrive' || e.at + (e.kind === 'holdShort' ? LINED_UP_M : PASSED_M) > along
  );
  const event = index >= 0 ? events[index]! : null;
  if (!event || arrived) return { offRoute, arrived, next: null, then: null };

  // Before joining, the way to the route counts toward the distance.
  const distance = Math.max(0, event.at - along) + (beforeStart ? lateral : 0);
  const following = events[index + 1];
  const then =
    following && event.kind !== 'holdShort' && following.at - event.at <= THEN_WINDOW_M
      ? following
      : null;
  const now = distance < (event.kind === 'holdShort' ? AT_HOLD_M : NOW_M);
  return { offRoute, arrived, next: { event, distance, now }, then };
}
