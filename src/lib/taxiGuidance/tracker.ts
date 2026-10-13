import { computeEvents, holdBarLines } from './events';
import {
  type RouteGeometry,
  bearingOf,
  buildGeometry,
  pointAtDistance,
  routeBetween,
  toLocal,
} from './geometry';
import { type GuidanceView, guidanceView } from './instruction';
import { type RouteProgress, trackProgress } from './progress';
import type { GuidanceEvent, GuidancePoint, GuidanceRoute } from './types';

/** Further than this from every route, the aircraft is somewhere else and nothing is tracked. */
const NEAR_ROUTE_M = 1500;
/** On the route, the arrow points at the route this far ahead, so it leads into turns. */
const AIM_AHEAD_M = 40;
/** Closer than this to the aimed point, its bearing is noise. */
const AIM_MIN_M = 3;

interface PreparedRoute {
  geometry: RouteGeometry;
  events: GuidanceEvent[];
  holdBars: GuidancePoint[][];
  /** Where the drawn route stops: a departure at the runway's hold line, else its end. */
  drawEnd: number;
  /** The route as drawn on the map. */
  drawn: GuidancePoint[];
}

const prepared = new WeakMap<GuidanceRoute, PreparedRoute>();

/** Geometry, events and hold bars of a route, computed once per route object. */
export function prepareRoute(route: GuidanceRoute): PreparedRoute {
  let p = prepared.get(route);
  if (!p) {
    const geometry = buildGeometry(route.points);
    const events = computeEvents(route, geometry);
    const hold =
      route.direction === 'departure'
        ? events.find((e) => e.kind === 'holdShort' && e.pointIndex !== null)
        : undefined;
    const drawEnd = hold?.at ?? geometry.total;
    p = {
      geometry,
      events,
      holdBars: holdBarLines(geometry, events),
      drawEnd,
      drawn: routeBetween(geometry, 0, drawEnd),
    };
    prepared.set(route, p);
  }
  return p;
}

export interface TrackedGuidance {
  route: GuidanceRoute;
  progress: RouteProgress;
  view: GuidanceView;
  /** The drawn route still ahead, from the aircraft's spot on it. */
  remaining: GuidancePoint[];
  /** Name of the taxiway the aircraft is following; null off it, on a runway or an unnamed connector. */
  taxiway: string | null;
  /**
   * True bearing from the aircraft to where it should head: the nearest point of
   * the route before joining it or once off it, else the route a little ahead.
   * Null once arrived or when that point is right under the aircraft.
   */
  bearing: number | null;
}

/**
 * Follows the aircraft along whichever planned route it is on. Keeps the last
 * fix per route between updates, so each window (main map, detached strip)
 * owns one tracker.
 */
export function createGuidanceTracker() {
  const last = new WeakMap<GuidanceRoute, RouteProgress>();

  return {
    update(
      routes: ReadonlyArray<GuidanceRoute>,
      position: { lat: number; lon: number } | null
    ): TrackedGuidance | null {
      if (!position) return null;
      let best: { route: GuidanceRoute; progress: RouteProgress } | null = null;
      for (const route of routes) {
        const { geometry } = prepareRoute(route);
        const p = toLocal(geometry, position.lat, position.lon);
        const progress = trackProgress(geometry, p, last.get(route) ?? null);
        if (!progress) continue;
        last.set(route, progress);
        if (
          progress.lateral <= NEAR_ROUTE_M &&
          (!best || progress.lateral < best.progress.lateral)
        ) {
          best = { route, progress };
        }
      }
      if (!best) return null;

      const { geometry, events, drawEnd } = prepareRoute(best.route);
      const { progress } = best;
      const view = guidanceView(events, progress, geometry.total);
      const { point } = pointAtDistance(geometry, progress.along);
      const remaining = routeBetween(geometry, progress.along, drawEnd);

      const onRoute = progress.joined && !view.offRoute;
      const leg = best.route.legs[progress.segIndex];
      const taxiway = onRoute && leg && !leg.isRunway && leg.name ? leg.name : null;
      const aim = onRoute ? pointAtDistance(geometry, progress.along + AIM_AHEAD_M).point : point;
      const here = toLocal(geometry, position.lat, position.lon);
      const bearing =
        view.arrived || Math.hypot(aim.x - here.x, aim.y - here.y) < AIM_MIN_M
          ? null
          : bearingOf(here, aim);

      return { route: best.route, progress, view, remaining, taxiway, bearing };
    },
  };
}
