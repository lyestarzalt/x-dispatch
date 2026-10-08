/**
 * Plan builder: the draft the user is editing, its resolution against the nav
 * database, and the hand-off to the map and to X-Plane. The draft persists;
 * the resolution and the resolved procedures are recomputed on load.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fmsFileStem, serializeFms } from '@/lib/flightplan/builder/fmsWriter';
import { builtProcedurePaths } from '@/lib/flightplan/builder/legGeometry';
import {
  type ProcedureParts,
  composePlan,
  enrichedFromPlan,
  planForFile,
  procedureEntry,
  procedureExit,
  sidFirstTurn,
  sidInitialClimbNm,
} from '@/lib/flightplan/builder/procedures';
import { tokenizeRoute } from '@/lib/flightplan/builder/routeTokens';
import { trackInRoute } from '@/lib/flightplan/builder/trackChoice';
import type {
  PlanDraft,
  PlanEndpoint,
  ProcedureChoice,
  RouteJoin,
  RouteResolveResult,
} from '@/lib/flightplan/builder/types';
import logger from '@/lib/utils/loggerRenderer';
import type { EnrichedFlightPlan, FMSFlightPlan, RunwayEnd } from '@/types/fms';
import type { RangeRingCategory } from '@/types/layers';
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
  setRunway: (
    end: 'departure' | 'arrival',
    runway: string | undefined,
    runwayEnd?: RunwayEnd
  ) => void;
  setProcedureChoice: (kind: ProcedureKind, choice: ProcedureChoice | undefined) => void;
  setResolvedProcedures: (parts: ProcedureParts) => void;
  swapEndpoints: () => void;
  setRouteText: (text: string) => void;
  removeRouteToken: (index: number) => void;
  setCruiseAltitude: (feet: number | null) => void;
  /** Re-resolves the current draft; stale responses are dropped. */
  resolve: () => Promise<void>;
  /** Asks the main process for a shortest airway route and puts it in the route field. */
  /** Candidate procedure joins let the router pick the SID and STAR along with the route; a
   * track designator ("NATA") makes it route through that North Atlantic track. */
  autoRoute: (
    joins?: { exits?: RouteJoin[]; entries?: RouteJoin[] },
    track?: string | null
  ) => Promise<boolean>;
  setAlternate: (endpoint: PlanEndpoint | null) => void;
  /** A track picked on the map, waiting for the dialog to route through it with its procedure
   * joins; null inside means "let the router choose". */
  trackRequest: { track: string | null } | null;
  requestTrack: (track: string | null) => void;
  clearTrackRequest: () => void;
  /** Planning class chosen by hand; null follows the aircraft loaded in X-Plane. */
  aircraftClass: RangeRingCategory | null;
  setAircraftClass: (cls: RangeRingCategory | null) => void;
  /** Enroute resolution with the chosen procedures stitched in, or null before the first resolve. */
  composed: () => { plan: FMSFlightPlan; enriched: EnrichedFlightPlan } | null;
  /** Pushes the composed plan into the flight plan store so the map draws it. */
  showOnMap: () => void;
  saveToXPlane: () => Promise<string | null>;
  startAtDeparture: () => void;
  reset: () => void;
}

let resolveRequest = 0;
/** The draft the current result answers; the same draft is not sent again. */
let resolvedDraft: string | null = null;

function draftKey(state: PlanDraft): string {
  return JSON.stringify([
    state.departure?.icao,
    state.departure?.runway,
    state.arrival?.icao,
    state.arrival?.runway,
    state.routeText,
    state.cruiseAltitudeFt,
  ]);
}

/** Takes the planner's plan off the map; a plan loaded from SimBrief or a file stays. */
function clearDrawnPlan(departure: PlanEndpoint | null, arrival: PlanEndpoint | null): void {
  const map = useFlightPlanStore.getState();
  if (!departure || !arrival || !map.fmsData || map.simbriefData) return;
  if (map.fileName === `${departure.icao}-${arrival.icao}`) map.clearFlightPlan();
}

export const usePlanBuilderStore = create<PlanBuilderState>()(
  persist(
    (set, get) => ({
      departure: null,
      arrival: null,
      alternate: null,
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

      // A route belongs to its pair of airports; changing either end starts the enroute part over.
      setDeparture: (endpoint) =>
        set((state) => {
          if (!endpoint) clearDrawnPlan(state.departure, state.arrival);
          return {
            departure: endpoint,
            ...(endpoint?.icao !== state.departure?.icao
              ? { routeText: '', cruiseAltitudeFt: null, result: null }
              : {}),
            savedPath: null,
          };
        }),
      setArrival: (endpoint) =>
        set((state) => {
          if (!endpoint) clearDrawnPlan(state.departure, state.arrival);
          return {
            arrival: endpoint,
            ...(endpoint?.icao !== state.arrival?.icao
              ? { routeText: '', cruiseAltitudeFt: null, result: null, alternate: null }
              : {}),
            savedPath: null,
          };
        }),
      setAlternate: (endpoint) => set({ alternate: endpoint }),
      trackRequest: null,
      requestTrack: (track) => set({ trackRequest: { track } }),
      clearTrackRequest: () => set({ trackRequest: null }),
      aircraftClass: null,
      // The cruise cap differs per class, so the suggestion is redone.
      setAircraftClass: (cls) => set({ aircraftClass: cls, cruiseAltitudeFt: null }),
      setRunway: (end, runway, runwayEnd) =>
        set((state) => {
          const endpoint = state[end];
          if (!endpoint) return {};
          // Same runway, geometry arriving later: keep the procedures.
          if (runway === endpoint.runway) return { [end]: { ...endpoint, runwayEnd } };
          // A runway change invalidates procedures published for the old one.
          const cleared =
            end === 'departure' ? { sid: undefined } : { star: undefined, approach: undefined };
          return { [end]: { ...endpoint, runway, runwayEnd, ...cleared }, savedPath: null };
        }),
      setProcedureChoice: (kind, choice) =>
        set((state) => {
          const end = kind === 'sid' ? 'departure' : 'arrival';
          const endpoint = state[end];
          if (!endpoint) return {};
          return { [end]: { ...endpoint, [kind]: choice }, savedPath: null };
        }),
      setResolvedProcedures: (parts) => {
        set({ procedures: parts });
        if (get().isOpen && get().result) get().showOnMap();
      },
      swapEndpoints: () =>
        set((state) => ({
          departure: state.arrival
            ? { ...state.arrival, sid: undefined, star: undefined, approach: undefined }
            : null,
          arrival: state.departure
            ? { ...state.departure, sid: undefined, star: undefined, approach: undefined }
            : null,
          // "A UL620 B" read backwards is still A and B joined by UL620. A NAT track is
          // one-way and the other direction has its own set, so that route starts over and
          // the auto router picks a track for the new crossing.
          routeText: trackInRoute(state.routeText)
            ? ''
            : tokenizeRoute(state.routeText).reverse().join(' '),
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
        const key = draftKey(get());
        if (get().status === 'ready' && get().result && resolvedDraft === key) return;
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
          resolvedDraft = result ? key : null;
          set(result ? { status: 'ready', result } : { status: 'error', result: null });
          // The map is the preview: every successful resolve redraws while the panel is open.
          if (result && get().isOpen) get().showOnMap();
        } catch (err) {
          if (request !== resolveRequest) return;
          logger.flight.error('Route resolution failed', err);
          set({ status: 'error', result: null });
        }
      },

      autoRoute: async (joins, track) => {
        const { departure, arrival, routeText, cruiseAltitudeFt, procedures } = get();
        if (!departure || !arrival) return false;
        set({ autoRouting: true });
        try {
          const exit = procedureExit(procedures.sid);
          const entry = procedureEntry(procedures.star ?? procedures.approach);
          const result = await window.flightPlanAPI.autoRoute({
            departure,
            arrival,
            routeText,
            cruiseAltitudeFt,
            routeFrom: exit && { latitude: exit.latitude, longitude: exit.longitude },
            routeTo: entry && { latitude: entry.latitude, longitude: entry.longitude },
            // Candidates only matter while that end has no procedure fixed yet.
            exits: exit ? undefined : joins?.exits,
            entries: entry ? undefined : joins?.entries,
            track: track ?? undefined,
          });
          if (!result) return false;
          set({ routeText: result.routeText, savedPath: null });
          if (result.sid) get().setProcedureChoice('sid', result.sid);
          if (result.star) get().setProcedureChoice('star', result.star);
          // The router's text needs no typing pause: resolve now, and the dialog's own
          // debounced resolve finds the draft already answered.
          await get().resolve();
          return true;
        } catch (err) {
          logger.flight.error('Auto route failed', err);
          return false;
        } finally {
          set({ autoRouting: false });
        }
      },

      composed: () => {
        const { result, procedures, departure, arrival, alternate } = get();
        if (!result) return null;
        const plan = composePlan(result.plan, procedures);
        const runwayEnds = { departure: departure?.runwayEnd, arrival: arrival?.runwayEnd };
        const alt = alternate
          ? { icao: alternate.icao, latitude: alternate.latitude, longitude: alternate.longitude }
          : undefined;
        return {
          plan,
          enriched: enrichedFromPlan(plan, {
            runwayEnds,
            firstTurn: sidFirstTurn(procedures.sid),
            initialClimbNm: sidInitialClimbNm(procedures.sid, departure?.runwayEnd?.lengthNm),
            procedurePaths: builtProcedurePaths(procedures, departure?.runwayEnd),
            alternate: alt,
          }),
        };
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
        const { departure, arrival, result, procedures } = get();
        if (!result || !departure || !arrival) return null;
        const response = await window.flightPlanAPI.saveFms({
          stem: fmsFileStem(departure.icao, arrival.icao),
          content: serializeFms(planForFile(result.plan, procedures)),
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

      reset: () => {
        clearDrawnPlan(get().departure, get().arrival);
        resolvedDraft = null;
        set({
          departure: null,
          arrival: null,
          alternate: null,
          routeText: '',
          cruiseAltitudeFt: null,
          status: 'idle',
          result: null,
          procedures: {},
          savedPath: null,
        });
      },
    }),
    {
      name: 'xplane-viz-plan-builder',
      // v2: RunwayEnd gained the optional `elevationFt` (nothing to convert - older saved runway
      // ends simply lack it until the runway is picked again).
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          // No field rewrite needed; kept as an explicit step so the cascade stays complete.
        }
        return state;
      },
      partialize: (state) => ({
        departure: state.departure,
        arrival: state.arrival,
        alternate: state.alternate,
        aircraftClass: state.aircraftClass,
        routeText: state.routeText,
        cruiseAltitudeFt: state.cruiseAltitudeFt,
      }),
    }
  )
);
