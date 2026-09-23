/**
 * Plan builder: the draft the user is editing, its resolution against the nav
 * database, and the hand-off to the map and to X-Plane. The draft persists;
 * the resolution and the resolved procedures are recomputed on load.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fmsFileStem, serializeFms } from '@/lib/flightplan/builder/fmsWriter';
import {
  type ProcedureParts,
  composePlan,
  enrichedFromPlan,
} from '@/lib/flightplan/builder/procedures';
import { tokenizeRoute } from '@/lib/flightplan/builder/routeTokens';
import type {
  PlanDraft,
  PlanEndpoint,
  ProcedureChoice,
  RouteResolveResult,
} from '@/lib/flightplan/builder/types';
import logger from '@/lib/utils/loggerRenderer';
import type { EnrichedFlightPlan, FMSFlightPlan } from '@/types/fms';
import { useAppStore } from './appStore';
import { useFlightPlanStore } from './flightPlanStore';

export type PlanBuilderStatus = 'idle' | 'resolving' | 'ready' | 'error';
export type ProcedureKind = 'sid' | 'star' | 'approach';

interface PlanBuilderState extends PlanDraft {
  isOpen: boolean;
  status: PlanBuilderStatus;
  result: RouteResolveResult | null;
  /** Resolved copies of the chosen procedures, supplied by the dialog once the airport data loads. */
  procedures: ProcedureParts;
  savedPath: string | null;
  autoRouting: boolean;

  open: () => void;
  close: () => void;
  setDeparture: (endpoint: PlanEndpoint | null) => void;
  setArrival: (endpoint: PlanEndpoint | null) => void;
  setRunway: (end: 'departure' | 'arrival', runway: string | undefined) => void;
  setProcedureChoice: (kind: ProcedureKind, choice: ProcedureChoice | undefined) => void;
  setResolvedProcedures: (parts: ProcedureParts) => void;
  swapEndpoints: () => void;
  setRouteText: (text: string) => void;
  removeRouteToken: (index: number) => void;
  setCruiseAltitude: (feet: number | null) => void;
  /** Re-resolves the current draft; stale responses are dropped. */
  resolve: () => Promise<void>;
  /** Asks the main process for a shortest airway route and puts it in the route field. */
  autoRoute: () => Promise<boolean>;
  /** Enroute resolution with the chosen procedures stitched in, or null before the first resolve. */
  composed: () => { plan: FMSFlightPlan; enriched: EnrichedFlightPlan } | null;
  /** Pushes the composed plan into the flight plan store so the map draws it. */
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
      procedures: {},
      savedPath: null,
      autoRouting: false,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),

      setDeparture: (endpoint) => set({ departure: endpoint, savedPath: null }),
      setArrival: (endpoint) => set({ arrival: endpoint, savedPath: null }),
      setRunway: (end, runway) =>
        set((state) => {
          const endpoint = state[end];
          if (!endpoint) return {};
          // A runway change invalidates procedures published for the old one.
          const cleared =
            end === 'departure' ? { sid: undefined } : { star: undefined, approach: undefined };
          return { [end]: { ...endpoint, runway, ...cleared }, savedPath: null };
        }),
      setProcedureChoice: (kind, choice) =>
        set((state) => {
          const end = kind === 'sid' ? 'departure' : 'arrival';
          const endpoint = state[end];
          if (!endpoint) return {};
          return { [end]: { ...endpoint, [kind]: choice }, savedPath: null };
        }),
      setResolvedProcedures: (parts) => set({ procedures: parts }),
      swapEndpoints: () =>
        set((state) => ({
          departure: state.arrival
            ? { ...state.arrival, sid: undefined, star: undefined, approach: undefined }
            : null,
          arrival: state.departure
            ? { ...state.departure, sid: undefined, star: undefined, approach: undefined }
            : null,
          procedures: {},
          savedPath: null,
        })),
      setRouteText: (text) => set({ routeText: text, savedPath: null }),
      removeRouteToken: (index) =>
        set((state) => {
          const tokens = tokenizeRoute(state.routeText);
          tokens.splice(index, 1);
          return { routeText: tokens.join(' '), savedPath: null };
        }),
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

      autoRoute: async () => {
        const { departure, arrival, routeText, cruiseAltitudeFt } = get();
        if (!departure || !arrival) return false;
        set({ autoRouting: true });
        try {
          const result = await window.flightPlanAPI.autoRoute({
            departure,
            arrival,
            routeText,
            cruiseAltitudeFt,
          });
          if (!result) return false;
          set({ routeText: result.routeText, savedPath: null });
          return true;
        } catch (err) {
          logger.flight.error('Auto route failed', err);
          return false;
        } finally {
          set({ autoRouting: false });
        }
      },

      composed: () => {
        const { result, procedures } = get();
        if (!result) return null;
        const plan = composePlan(result.plan, procedures);
        return { plan, enriched: enrichedFromPlan(plan) };
      },

      showOnMap: () => {
        const { departure, arrival } = get();
        const composed = get().composed();
        if (!composed || !departure || !arrival) return;
        useFlightPlanStore.setState({
          fmsData: composed.enriched,
          simbriefData: null,
          fileName: `${departure.icao}-${arrival.icao}`,
          isEnriching: false,
          selectedWaypointIndex: null,
          showFlightPlanBar: true,
          departure: {
            icao: departure.icao,
            runway: departure.runway,
            procedure: composed.plan.departure.sid,
            transition: composed.plan.departure.sidTransition,
          },
          arrival: {
            icao: arrival.icao,
            runway: arrival.runway,
            procedure: composed.plan.arrival.star,
            transition: composed.plan.arrival.starTransition,
          },
        });
      },

      saveToXPlane: async () => {
        const { departure, arrival } = get();
        const composed = get().composed();
        if (!composed || !departure || !arrival) return null;
        const response = await window.flightPlanAPI.saveFms({
          stem: fmsFileStem(departure.icao, arrival.icao),
          content: serializeFms(composed.plan),
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
          procedures: {},
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
