/**
 * Plan builder: the draft the user is editing, its resolution against the nav
 * database, and the hand-off to the map and to X-Plane. The draft persists;
 * the resolution is recomputed on load.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fmsFileStem, serializeFms } from '@/lib/flightplan/builder/fmsWriter';
import type { PlanDraft, PlanEndpoint, RouteResolveResult } from '@/lib/flightplan/builder/types';
import logger from '@/lib/utils/loggerRenderer';
import { useAppStore } from './appStore';
import { useFlightPlanStore } from './flightPlanStore';

export type PlanBuilderStatus = 'idle' | 'resolving' | 'ready' | 'error';

interface PlanBuilderState extends PlanDraft {
  isOpen: boolean;
  status: PlanBuilderStatus;
  result: RouteResolveResult | null;
  savedPath: string | null;

  open: () => void;
  close: () => void;
  setDeparture: (endpoint: PlanEndpoint | null) => void;
  setArrival: (endpoint: PlanEndpoint | null) => void;
  setRunway: (end: 'departure' | 'arrival', runway: string | undefined) => void;
  swapEndpoints: () => void;
  setRouteText: (text: string) => void;
  setCruiseAltitude: (feet: number | null) => void;
  /** Re-resolves the current draft; stale responses are dropped. */
  resolve: () => Promise<void>;
  /** Pushes the resolved plan into the flight plan store so the map draws it. */
  showOnMap: () => void;
  saveToXPlane: () => Promise<string | null>;
  startAtDeparture: () => void;
  reset: () => void;
}

let resolveRequest = 0;

export const usePlanBuilderStore = create<PlanBuilderState>()(
  persist(
    (set, get) => ({
      departure: null,
      arrival: null,
      routeText: '',
      cruiseAltitudeFt: null,
      isOpen: false,
      status: 'idle',
      result: null,
      savedPath: null,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      setDeparture: (endpoint) => set({ departure: endpoint, savedPath: null }),
      setArrival: (endpoint) => set({ arrival: endpoint, savedPath: null }),
      setRunway: (end, runway) =>
        set((state) => {
          const endpoint = state[end];
          if (!endpoint) return {};
          return { [end]: { ...endpoint, runway }, savedPath: null };
        }),
      swapEndpoints: () =>
        set((state) => ({ departure: state.arrival, arrival: state.departure, savedPath: null })),
      setRouteText: (text) => set({ routeText: text, savedPath: null }),
      setCruiseAltitude: (feet) => set({ cruiseAltitudeFt: feet, savedPath: null }),

      resolve: async () => {
        const { departure, arrival, routeText, cruiseAltitudeFt } = get();
        if (!departure || !arrival) {
          set({ status: 'idle', result: null });
          return;
        }
        const request = ++resolveRequest;
        set({ status: 'resolving' });
        try {
          const result = await window.flightPlanAPI.resolveRoute({
            departure,
            arrival,
            routeText,
            cruiseAltitudeFt,
          });
          if (request !== resolveRequest) return;
          set(result ? { status: 'ready', result } : { status: 'error', result: null });
        } catch (err) {
          if (request !== resolveRequest) return;
          logger.flight.error('Route resolution failed', err);
          set({ status: 'error', result: null });
        }
      },

      showOnMap: () => {
        const { result, departure, arrival } = get();
        if (!result || !departure || !arrival) return;
        useFlightPlanStore.setState({
          fmsData: result.enriched,
          simbriefData: null,
          fileName: `${departure.icao}-${arrival.icao}`,
          isEnriching: false,
          selectedWaypointIndex: null,
          showFlightPlanBar: true,
          departure: { icao: departure.icao, runway: departure.runway },
          arrival: { icao: arrival.icao, runway: arrival.runway },
        });
      },

      saveToXPlane: async () => {
        const { result, departure, arrival } = get();
        if (!result || !departure || !arrival) return null;
        const response = await window.flightPlanAPI.saveFms({
          stem: fmsFileStem(departure.icao, arrival.icao),
          content: serializeFms(result.plan),
        });
        if (!response.success || !response.path) {
          throw new Error(response.error ?? 'save failed');
        }
        set({ savedPath: response.path });
        return response.path;
      },

      startAtDeparture: () => {
        const { departure } = get();
        if (!departure) return;
        useAppStore.getState().requestSelectAirport(departure.icao);
        set({ isOpen: false });
      },

      reset: () =>
        set({
          departure: null,
          arrival: null,
          routeText: '',
          cruiseAltitudeFt: null,
          status: 'idle',
          result: null,
          savedPath: null,
        }),
    }),
    {
      name: 'xplane-viz-plan-builder',
      version: 1,
      partialize: (state) => ({
        departure: state.departure,
        arrival: state.arrival,
        routeText: state.routeText,
        cruiseAltitudeFt: state.cruiseAltitudeFt,
      }),
    }
  )
);
