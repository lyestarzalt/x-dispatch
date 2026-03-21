/**
 * Flight Plan Store
 * Manages the user's flight plan with departure, arrival, and route waypoints
 */
import { create } from 'zustand';
import { parseFMSFile } from '@/lib/parsers/fms';
import type { EnrichedFlightPlan, FlightPlanChip } from '@/types/fms';
import type { SimBriefOFP } from '@/types/simbrief';
import { useAppStore } from './appStore';

export interface FlightPlanWaypoint {
  id: string; // Fix ID (e.g., "LOGEN", "BOS", "J42")
  type: 'airport' | 'waypoint' | 'navaid' | 'airway';
  latitude?: number; // Resolved coordinates
  longitude?: number;
  via?: string; // Airway name if applicable
  name?: string; // Display name
}

export interface FlightPlanEndpoint {
  icao: string;
  runway?: string;
  procedure?: string; // SID/STAR name
  transition?: string;
}

interface FlightPlanState {
  departure: FlightPlanEndpoint | null;
  arrival: FlightPlanEndpoint | null;
  route: FlightPlanWaypoint[];
  cruiseAltitude: number | null;

  // FMS-specific (enriched with nav database data)
  fmsData: EnrichedFlightPlan | null;
  fileName: string | null;
  isEnriching: boolean;

  // SimBrief data (rich info beyond just route)
  simbriefData: SimBriefOFP | null;

  // UI state
  selectedWaypointIndex: number | null;
  showFlightPlanBar: boolean;

  // Actions
  setDeparture: (endpoint: FlightPlanEndpoint | null) => void;
  setArrival: (endpoint: FlightPlanEndpoint | null) => void;
  addWaypoint: (waypoint: FlightPlanWaypoint) => void;
  removeWaypoint: (index: number) => void;
  updateWaypoint: (index: number, waypoint: Partial<FlightPlanWaypoint>) => void;
  setRoute: (waypoints: FlightPlanWaypoint[]) => void;
  setCruiseAltitude: (altitude: number | null) => void;
  clearRoute: () => void;
  clearAll: () => void;

  // FMS Actions
  loadFMSFile: (content: string, fileName: string) => Promise<boolean>;
  setSelectedWaypoint: (index: number | null) => void;
  clearFlightPlan: () => void;
  getChips: () => FlightPlanChip[];

  // SimBrief Actions
  loadFromSimbrief: (data: SimBriefOFP) => void;

  // Parse route string (e.g., "KJFK LOGEN J42 BOSSS KATL")
  parseRouteString: (routeString: string) => void;
}

export const useFlightPlanStore = create<FlightPlanState>((set, get) => ({
  departure: null,
  arrival: null,
  route: [],
  cruiseAltitude: null,
  fmsData: null,
  fileName: null,
  isEnriching: false,
  simbriefData: null,
  selectedWaypointIndex: null,
  showFlightPlanBar: false,

  setDeparture: (endpoint) => set({ departure: endpoint }),

  setArrival: (endpoint) => set({ arrival: endpoint }),

  addWaypoint: (waypoint) =>
    set((state) => ({
      route: [...state.route, waypoint],
    })),

  removeWaypoint: (index) =>
    set((state) => ({
      route: state.route.filter((_, i) => i !== index),
    })),

  updateWaypoint: (index, updates) =>
    set((state) => ({
      route: state.route.map((wp, i) => (i === index ? { ...wp, ...updates } : wp)),
    })),

  setRoute: (waypoints) => set({ route: waypoints }),

  setCruiseAltitude: (altitude) => set({ cruiseAltitude: altitude }),

  clearRoute: () => set({ route: [] }),

  clearAll: () => {
    useAppStore.getState().selectProcedure(null);
    set({
      departure: null,
      arrival: null,
      route: [],
      cruiseAltitude: null,
      fmsData: null,
      fileName: null,
      isEnriching: false,
      simbriefData: null,
      selectedWaypointIndex: null,
      showFlightPlanBar: false,
    });
  },

  loadFMSFile: async (content, fileName) => {
    const result = parseFMSFile(content);
    if (!result.success || !result.data) {
      return false;
    }

    // Clear previous flight plan and set initial state
    set({
      fmsData: null,
      simbriefData: null,
      isEnriching: true,
      showFlightPlanBar: true,
      selectedWaypointIndex: null,
      departure: {
        icao: result.data.departure.icao,
        runway: result.data.departure.runway,
        procedure: result.data.departure.sid,
        transition: result.data.departure.sidTransition,
      },
      arrival: {
        icao: result.data.arrival.icao,
        runway: result.data.arrival.runway,
        procedure: result.data.arrival.star,
        transition: result.data.arrival.starTransition,
      },
    });

    // Enrich with nav database data
    try {
      const enriched = await window.flightPlanAPI.enrich(result.data);
      if (enriched) {
        set({
          fmsData: enriched,
          fileName,
          isEnriching: false,
        });
        return true;
      } else {
        console.warn('[FlightPlan] Enrichment returned null');
      }
    } catch (err) {
      console.error('[FlightPlan] Failed to enrich flight plan:', err);
    }

    // Fallback: use raw FMS data if enrichment fails
    set({
      fmsData: {
        ...result.data,
        waypoints: result.data.waypoints.map((wp) => ({ ...wp, found: true })),
        resolution: {
          total: result.data.waypoints.length,
          found: result.data.waypoints.length,
          notFound: 0,
          cycleMatch: true,
        },
      },
      fileName,
      isEnriching: false,
    });
    return true;
  },

  setSelectedWaypoint: (index) => set({ selectedWaypointIndex: index }),

  clearFlightPlan: () => {
    useAppStore.getState().selectProcedure(null);
    set({
      fmsData: null,
      fileName: null,
      isEnriching: false,
      simbriefData: null,
      selectedWaypointIndex: null,
      showFlightPlanBar: false,
      departure: null,
      arrival: null,
      route: [],
    });
  },

  loadFromSimbrief: (data) => {
    // Map SimBrief fix type to FMS waypoint type
    const mapFixType = (type: string): 1 | 2 | 3 | 11 | 28 => {
      switch (type) {
        case 'apt':
          return 1; // Airport
        case 'ndb':
          return 2; // NDB
        case 'vor':
          return 3; // VOR
        case 'ltlg':
          return 28; // Lat/Lon
        default:
          return 11; // Fix/waypoint
      }
    };

    // Convert SimBrief to EnrichedFlightPlan for map layer
    const enrichedPlan: EnrichedFlightPlan = {
      version: 1100,
      cycle: data.general.airac,
      departure: {
        icao: data.origin.icao_code,
        runway: data.origin.plan_rwy,
      },
      arrival: {
        icao: data.destination.icao_code,
        runway: data.destination.plan_rwy,
      },
      waypoints: data.navlog.fix.map((fix) => ({
        type: mapFixType(fix.type),
        id: fix.ident,
        via: fix.via_airway || 'DRCT',
        altitude: parseInt(fix.altitude_feet, 10),
        latitude: parseFloat(fix.pos_lat),
        longitude: parseFloat(fix.pos_long),
        found: true,
        stage: fix.stage as 'CLB' | 'CRZ' | 'DSC',
        frequency: fix.frequency ? parseFloat(fix.frequency) : undefined,
      })),
      alternate: data.alternate
        ? {
            icao: data.alternate.icao_code,
            latitude: parseFloat(data.alternate.pos_lat),
            longitude: parseFloat(data.alternate.pos_long),
          }
        : undefined,
      resolution: {
        total: data.navlog.fix.length,
        found: data.navlog.fix.length,
        notFound: 0,
        cycleMatch: true,
      },
    };

    set({
      simbriefData: data,
      fmsData: enrichedPlan,
      fileName: `SimBrief: ${data.origin.icao_code}-${data.destination.icao_code}`,
      showFlightPlanBar: true,
      departure: {
        icao: data.origin.icao_code,
        runway: data.origin.plan_rwy,
      },
      arrival: {
        icao: data.destination.icao_code,
        runway: data.destination.plan_rwy,
      },
    });
  },

  getChips: () => {
    const { fmsData } = get();
    if (!fmsData) return [];

    const chips: FlightPlanChip[] = [];

    // Departure airport
    chips.push({ type: 'departure', id: fmsData.departure.icao });

    // SID procedure
    if (fmsData.departure.sid) {
      chips.push({ type: 'sid', id: fmsData.departure.sid });
    }

    // Waypoints
    fmsData.waypoints.forEach((wp, index) => {
      // Skip departure/arrival airports in waypoint list
      if (wp.via === 'ADEP' || wp.via === 'ADES') return;

      let chipType: FlightPlanChip['type'] = 'fix';
      if (wp.type === 3) chipType = 'vor';
      else if (wp.type === 2) chipType = 'ndb';
      else if (wp.type === 28) chipType = 'latlon';

      chips.push({
        type: chipType,
        id: wp.id,
        via: wp.via,
        altitude: wp.altitude,
        latitude: wp.latitude,
        longitude: wp.longitude,
        waypointIndex: index,
      });
    });

    // STAR procedure
    if (fmsData.arrival.star) {
      chips.push({ type: 'star', id: fmsData.arrival.star });
    }

    // Arrival airport
    chips.push({ type: 'arrival', id: fmsData.arrival.icao });

    return chips;
  },

  parseRouteString: (routeString) => {
    const parts = routeString.toUpperCase().trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) return;

    const waypoints: FlightPlanWaypoint[] = [];
    let currentAirway: string | null = null;

    for (const part of parts) {
      // Check if it looks like an airway (starts with letter, has number)
      const isAirway = /^[A-Z]\d+$|^[A-Z]{1,2}\d{1,3}$/.test(part);

      if (isAirway) {
        currentAirway = part;
      } else {
        // It's a waypoint/navaid/airport
        const wp: FlightPlanWaypoint = {
          id: part,
          type: part.length === 4 ? 'airport' : part.length === 5 ? 'waypoint' : 'navaid',
          via: currentAirway || undefined,
        };
        waypoints.push(wp);
        currentAirway = null;
      }
    }

    // First waypoint is departure, last is arrival
    if (waypoints.length >= 2) {
      const first = waypoints[0];
      const last = waypoints[waypoints.length - 1];

      set({
        departure: first.type === 'airport' ? { icao: first.id } : null,
        arrival: last.type === 'airport' ? { icao: last.id } : null,
        route: waypoints.slice(
          first.type === 'airport' ? 1 : 0,
          last.type === 'airport' ? -1 : undefined
        ),
      });
    } else if (waypoints.length === 1) {
      set({ route: waypoints });
    }
  },
}));
