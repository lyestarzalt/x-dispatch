import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ParsedAirport } from '@/lib/aptParser';
import { Position } from '@/types/geo';

interface StartPosition extends Position {
  type: 'runway' | 'ramp';
  name: string;
  airport: string;
}

interface SelectedProcedure {
  type: 'SID' | 'STAR' | 'APPROACH';
  name: string;
  runway: string | null;
  transition: string | null;
  waypoints: Array<{
    fixId: string;
    fixRegion: string;
    fixType: string;
    pathTerminator: string;
    course: number | null;
    distance: number | null;
    altitude: { descriptor: string; altitude1: number | null; altitude2: number | null } | null;
    speed: number | null;
    turnDirection: 'L' | 'R' | null;
  }>;
}

interface AppState {
  // Selected airport
  selectedICAO: string | null;
  selectedAirportData: ParsedAirport | null;

  // UI panels
  showSidebar: boolean;
  showSettings: boolean;
  showLaunchDialog: boolean;

  // Procedures
  selectedProcedure: SelectedProcedure | null;

  // Launch configuration
  startPosition: StartPosition | null;

  // Actions
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
    // Initial state
    selectedICAO: null as string | null,
    selectedAirportData: null as ParsedAirport | null,
    showSidebar: true,
    showSettings: false,
    showLaunchDialog: false,
    selectedProcedure: null as SelectedProcedure | null,
    startPosition: null as StartPosition | null,

    // Actions
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

const selectSelectedICAO = (state: AppState) => state.selectedICAO;
const selectSelectedAirport = (state: AppState) => state.selectedAirportData;
const selectShowSidebar = (state: AppState) => state.showSidebar;
const selectShowSettings = (state: AppState) => state.showSettings;
const selectShowLaunchPanel = (state: AppState) => state.showLaunchDialog;
const selectProcedure = (state: AppState) => state.selectedProcedure;
const selectStartPosition = (state: AppState) => state.startPosition;
