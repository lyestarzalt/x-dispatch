import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { AddonManagerTab, AirportPanelTab, SettingsTab } from '@/lib/nativeShell/appUrl';
import type { ParsedAirport } from '@/types/apt';
import type { ResolvedProcedure as SelectedProcedure } from '@/types/navigation';
import type { StartPosition } from '@/types/position';

interface AppState {
  selectedICAO: string | null;
  selectedAirportData: ParsedAirport | null;
  selectedAirportIsCustom: boolean;
  showSidebar: boolean;
  showSettings: boolean;
  /** Request for the Settings dialog to open on a tab (the menu's Check for Updates); it clears it. */
  pendingSettingsTab: SettingsTabRequest | null;
  showLaunchDialog: boolean;
  selectedProcedure: SelectedProcedure | null;
  startPosition: StartPosition | null;
  /**
   * ICAO of an airport that some component (flight-plan chip, SimBrief
   * dialog, etc.) has requested be loaded as the active airport. The Map
   * subscribes, looks the ICAO up in its airports list, runs the full
   * `selectAirport` flow (parse apt.dat, render layers), and clears.
   *
   * This is a request channel, not application state. Producers fire and
   * forget; the Map is the single consumer.
   */
  pendingAirportSelectionIcao: string | null;
  /** A link asked for a tab of the airport panel; the panel switches and clears. */
  pendingAirportTab: AirportPanelTab | null;
  /** A link asked for a runway end as the start position; the Map resolves it once the airport is loaded. */
  pendingStartRunway: { icao: string; runway: string } | null;
  showAddonManager: boolean;
  /** Tab the Addon Manager opens on; it clears it. */
  pendingAddonTab: AddonManagerTab | null;
  /** A link wants to fetch something remote; the dialog asks and resolves. */
  pendingConfirmation: AppActionConfirmation | null;
  /** Native full screen: no traffic lights, no OS controls, the title bar adapts. */
  windowFullScreen: boolean;
  showShortcuts: boolean;
  logbook: { open: boolean; tab: LogbookTab; flightId: string | null };

  selectAirport: (icao: string, data: ParsedAirport, isCustom?: boolean) => void;
  clearAirport: () => void;
  setShowSidebar: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  openSettings: (tab?: SettingsTabRequest | null) => void;
  clearPendingSettingsTab: () => void;
  setShowLaunchDialog: (show: boolean) => void;
  selectProcedure: (procedure: SelectedProcedure | null) => void;
  setStartPosition: (position: StartPosition | null) => void;
  /** Producer: fire-and-forget request to navigate to an airport by ICAO. */
  requestSelectAirport: (icao: string) => void;
  /** Consumer: clears the pending request once handled (or to drop it). */
  clearPendingAirportSelection: () => void;
  requestAirportTab: (tab: AirportPanelTab) => void;
  clearPendingAirportTab: () => void;
  requestStartRunway: (icao: string, runway: string) => void;
  clearPendingStartRunway: () => void;
  openAddonManager: (tab?: AddonManagerTab | null) => void;
  closeAddonManager: () => void;
  clearPendingAddonTab: () => void;
  requestConfirmation: (confirmation: AppActionConfirmation) => void;
  /** Answers and clears the pending confirmation. */
  resolveConfirmation: (accepted: boolean) => void;
  setWindowFullScreen: (fullScreen: boolean) => void;
  setShowShortcuts: (show: boolean) => void;
  openLogbook: (tab?: LogbookTab, flightId?: string | null) => void;
  closeLogbook: () => void;
  setLogbookTab: (tab: LogbookTab) => void;
  setLogbookFlight: (flightId: string | null) => void;
}

export type LogbookTab = 'flights' | 'launches';
export type SettingsTabRequest = SettingsTab;

/** What a link wants to download, shown to the user before anything is fetched. */
export interface AppActionConfirmation {
  kind: 'import-url';
  url: string;
  host: string;
  path: string;
  resolve: (accepted: boolean) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    selectedICAO: null as string | null,
    selectedAirportData: null as ParsedAirport | null,
    selectedAirportIsCustom: false,
    showSidebar: true,
    showSettings: false,
    pendingSettingsTab: null as SettingsTabRequest | null,
    showLaunchDialog: false,
    selectedProcedure: null as SelectedProcedure | null,
    startPosition: null as StartPosition | null,
    pendingAirportSelectionIcao: null as string | null,
    pendingAirportTab: null as AirportPanelTab | null,
    pendingStartRunway: null as { icao: string; runway: string } | null,
    showAddonManager: false,
    pendingAddonTab: null as AddonManagerTab | null,
    pendingConfirmation: null as AppActionConfirmation | null,
    windowFullScreen: false,
    showShortcuts: false,
    logbook: { open: false, tab: 'flights' as LogbookTab, flightId: null as string | null },

    selectAirport: (icao, data, isCustom) =>
      set({
        selectedICAO: icao,
        selectedAirportData: data,
        selectedAirportIsCustom: isCustom ?? false,
        showSidebar: true,
        // Clear procedure and start position when airport changes
        selectedProcedure: null,
        startPosition: null,
      }),

    clearAirport: () =>
      set({
        selectedICAO: null,
        selectedAirportData: null,
        selectedAirportIsCustom: false,
        selectedProcedure: null,
        startPosition: null,
      }),

    setShowSidebar: (show) => set({ showSidebar: show }),
    setShowSettings: (show) => set({ showSettings: show }),
    openSettings: (tab) => set({ showSettings: true, pendingSettingsTab: tab ?? null }),
    clearPendingSettingsTab: () => set({ pendingSettingsTab: null }),
    setShowLaunchDialog: (show) => set({ showLaunchDialog: show }),

    selectProcedure: (procedure) => set({ selectedProcedure: procedure }),

    setStartPosition: (position) => set({ startPosition: position }),

    requestSelectAirport: (icao) => set({ pendingAirportSelectionIcao: icao.toUpperCase() }),

    clearPendingAirportSelection: () => set({ pendingAirportSelectionIcao: null }),

    requestAirportTab: (tab) => set({ pendingAirportTab: tab }),
    clearPendingAirportTab: () => set({ pendingAirportTab: null }),
    requestStartRunway: (icao, runway) =>
      set({ pendingStartRunway: { icao: icao.toUpperCase(), runway: runway.toUpperCase() } }),
    clearPendingStartRunway: () => set({ pendingStartRunway: null }),

    openAddonManager: (tab) => set({ showAddonManager: true, pendingAddonTab: tab ?? null }),
    closeAddonManager: () => set({ showAddonManager: false }),
    clearPendingAddonTab: () => set({ pendingAddonTab: null }),

    requestConfirmation: (confirmation) =>
      set((state) => {
        // Only one question at a time; a second link answers the first with "no".
        state.pendingConfirmation?.resolve(false);
        return { pendingConfirmation: confirmation };
      }),
    setWindowFullScreen: (fullScreen) => set({ windowFullScreen: fullScreen }),
    setShowShortcuts: (show) => set({ showShortcuts: show }),

    resolveConfirmation: (accepted) =>
      set((state) => {
        state.pendingConfirmation?.resolve(accepted);
        return { pendingConfirmation: null };
      }),

    openLogbook: (tab, flightId) =>
      set((state) => ({
        logbook: {
          open: true,
          tab: tab ?? state.logbook.tab,
          flightId: flightId === undefined ? state.logbook.flightId : flightId,
        },
      })),
    closeLogbook: () => set((state) => ({ logbook: { ...state.logbook, open: false } })),
    setLogbookTab: (tab) => set((state) => ({ logbook: { ...state.logbook, tab } })),
    setLogbookFlight: (flightId) => set((state) => ({ logbook: { ...state.logbook, flightId } })),
  }))
);
