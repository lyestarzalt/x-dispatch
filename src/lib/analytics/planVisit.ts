import { trackInRoute } from '@/lib/flightplan/builder/trackChoice';
import type { PlanEndpoint } from '@/lib/flightplan/builder/types';
import type { RangeRingCategory } from '@/types/layers';
import { dialogTimeBucket } from './buckets';
import type { AnalyticsEventProps } from './events';

/** One planner visit, from open to close. */
export interface PlanVisit {
  openedAt: number;
  /** How the route text last changed: typed, auto-routed, or already there on open. */
  route: 'typed' | 'auto' | 'restored' | null;
  /** ICAO taken from the random destination panel, if any. */
  randomArrival: string | null;
  saved: boolean;
  startSet: boolean;
}

interface PlanState {
  departure: PlanEndpoint | null;
  arrival: PlanEndpoint | null;
  routeText: string;
  alternate?: PlanEndpoint | null;
}

/** The flight_plan_closed properties for a visit: how far the plan got, never its content. */
export function planVisitSummary(
  plan: PlanState,
  visit: PlanVisit,
  aircraftClass: RangeRingCategory,
  now: number
): AnalyticsEventProps<'flight_plan_closed'> {
  const { departure, arrival, routeText } = plan;
  const route =
    !departure || !arrival
      ? 'none'
      : routeText.trim() === ''
        ? 'direct'
        : trackInRoute(routeText)
          ? 'track'
          : (visit.route ?? 'typed');
  return {
    has_departure: departure !== null,
    has_arrival: arrival !== null,
    route,
    procedures: [departure?.sid, arrival?.star, arrival?.approach].filter(Boolean).length,
    alternate: !!plan.alternate,
    aircraft_class: aircraftClass,
    arrival_from_random: visit.randomArrival !== null && visit.randomArrival === arrival?.icao,
    saved: visit.saved,
    start_set: visit.startSet,
    time_open: dialogTimeBucket(now - visit.openedAt),
  };
}
