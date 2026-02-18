import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ParsedAirport } from '@/types/apt';
import type { StartPosition } from '@/types/position';

interface SelectedProcedureWaypoint {
  fixId: string;
  fixRegion: string;
  fixType: string;
  pathTerminator: string;
  course: number | null;
  distance: number | null;
  altitude: { descriptor: string; altitude1: number | null; altitude2: number | null } | null;
  speed: number | null;
  turnDirection: 'L' | 'R' | null;
  // Resolved coordinates (from ResolvedAirportProcedures)
  latitude?: number;
  longitude?: number;
  resolved?: boolean;
}

interface SelectedProcedure {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  runway: string | null;
  transition: string | null;
  waypoints: SelectedProcedureWaypoint[];
}

interface AppState {
  selectedICAO: string | null;
  selectedAirportData: ParsedAirport | null;
  showSidebar: boolean;
  showSettings: boolean;
  showLaunchDialog: boolean;
  selectedProcedure: SelectedProcedure | null;
  startPosition: StartPosition | null;

  selectAirport: (icao: string, data: ParsedAirport) => void;
  clearAirport: () => void;
  setShowSidebar: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setShowLaunchDialog: (show: boolean) => void;
  selectProcedure: (procedure: SelectedProcedure | null) => void;
  setStartPosition: (position: StartPosition | null) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    selectedICAO: null as string | null,
    selectedAirportData: null as ParsedAirport | null,
    showSidebar: true,
    showSettings: false,
    showLaunchDialog: false,
    selectedProcedure: null as SelectedProcedure | null,
    startPosition: null as StartPosition | null,

    selectAirport: (icao, data) =>
      set({
        selectedICAO: icao,
        selectedAirportData: data,
        showSidebar: true,
        // Clear procedure when airport changes
        selectedProcedure: null,
      }),

    clearAirport: () =>
      set({
        selectedICAO: null,
        selectedAirportData: null,
        selectedProcedure: null,
        startPosition: null,
      }),

    setShowSidebar: (show) => set({ showSidebar: show }),
    setShowSettings: (show) => set({ showSettings: show }),
    setShowLaunchDialog: (show) => set({ showLaunchDialog: show }),

    selectProcedure: (procedure) => set({ selectedProcedure: procedure }),

    setStartPosition: (position) => set({ startPosition: position }),
  }))
);
