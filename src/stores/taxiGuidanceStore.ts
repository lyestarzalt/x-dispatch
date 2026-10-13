/**
 * Taxi Guidance Store
 * The planned taxi routes the pilot is guided along, one per direction, so a
 * departure and an arrival can both be ready before the flight.
 *
 * The main window owns them and sends every change to main, which hands them
 * to the detached flight strip window (`useFlightStripWindowSync`,
 * `useFlightStripGuidance`). Kept in memory only: a route belongs to the
 * session it was planned in.
 */
import { create } from 'zustand';
import type { GuidanceDirection, GuidanceRoute } from '@/lib/taxiGuidance';
import type { GuidanceRoutes } from '@/lib/taxiGuidance/windowRoutes';

interface TaxiGuidanceState extends GuidanceRoutes {
  setRoute: (route: GuidanceRoute) => void;
  clearRoute: (direction: GuidanceDirection) => void;
  /** Strip window: take the routes the main window planned. */
  setRoutes: (routes: GuidanceRoutes) => void;
}

export const useTaxiGuidanceStore = create<TaxiGuidanceState>()((set) => ({
  departure: null,
  arrival: null,
  setRoute: (route) => set({ [route.direction]: route }),
  clearRoute: (direction) => set({ [direction]: null }),
  setRoutes: ({ departure, arrival }) => set({ departure, arrival }),
}));

/** The planned routes, departure first. */
export function guidanceRoutes(state: GuidanceRoutes) {
  const routes: GuidanceRoute[] = [];
  if (state.departure) routes.push(state.departure);
  if (state.arrival) routes.push(state.arrival);
  return routes;
}
