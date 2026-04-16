/**
 * Taxi Route Store
 * Manages taxi route state for airport ground navigation.
 *
 * Users click on the map to add waypoints, creating a connected
 * taxi route path. Simple, reliable, no pathfinding confusion.
 * Text input is still available for reference but clicking is primary.
 */
import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface TaxiRoutePoint {
  longitude: number;
  latitude: number;
}

interface TaxiRouteState {
  /** Ordered waypoints clicked by the user */
  waypoints: TaxiRoutePoint[];
  /** ICAO of the airport taxi mode is active for, or null when inactive */
  activeTaxiIcao: string | null;
  /** Whether click-to-add mode is enabled */
  clickModeEnabled: boolean;

  // Actions
  setActiveAirport: (icao: string) => void;
  addWaypoint: (lon: number, lat: number) => void;
  removeLastWaypoint: () => void;
  clearRoute: () => void;
  deactivate: () => void;
  setClickModeEnabled: (enabled: boolean) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useTaxiRouteStore = create<TaxiRouteState>()((set) => ({
  waypoints: [],
  activeTaxiIcao: null,
  clickModeEnabled: false,

  setActiveAirport: (icao: string) =>
    set({ activeTaxiIcao: icao.toUpperCase(), waypoints: [], clickModeEnabled: false }),

  addWaypoint: (lon, lat) =>
    set((state) => ({
      waypoints: [...state.waypoints, { longitude: lon, latitude: lat }],
    })),

  removeLastWaypoint: () =>
    set((state) => ({
      waypoints: state.waypoints.length > 0 ? state.waypoints.slice(0, -1) : state.waypoints,
    })),

  clearRoute: () => set({ waypoints: [] }),

  deactivate: () => set({ activeTaxiIcao: null, waypoints: [], clickModeEnabled: false }),

  setClickModeEnabled: (enabled: boolean) => set({ clickModeEnabled: enabled }),
}));

// ============================================================================
// Derived selectors
// ============================================================================

/** Whether taxi route mode is active. */
export function useTaxiModeActive(): boolean {
  return useTaxiRouteStore((s) => s.activeTaxiIcao !== null);
}
