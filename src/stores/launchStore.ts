import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Aircraft } from '@/types/aircraft';

interface LaunchState {
  // Selection
  selectedAircraft: Aircraft | null;
  selectedLivery: string;

  // Flight Config
  tankPercentages: number[];
  payloadWeights: number[];
  timeOfDay: number;
  useRealWorldTime: boolean;
  coldAndDark: boolean;
  selectedWeather: string;

  // Favorites (persisted to localStorage)
  favorites: string[];

  // UI State
  isLaunching: boolean;
  launchError: string | null;

  // Actions
  selectAircraft: (aircraft: Aircraft | null) => void;
  setSelectedLivery: (livery: string) => void;
  setTankPercentage: (index: number, value: number) => void;
  setAllTanksPercentage: (value: number) => void;
  setPayloadWeight: (index: number, value: number) => void;
  setTimeOfDay: (value: number) => void;
  setUseRealWorldTime: (value: boolean) => void;
  setColdAndDark: (value: boolean) => void;
  setSelectedWeather: (value: string) => void;
  toggleFavorite: (path: string) => void;
  setIsLaunching: (value: boolean) => void;
  setLaunchError: (error: string | null) => void;
  resetConfig: () => void;
}

const DEFAULT_CONFIG = {
  selectedAircraft: null,
  selectedLivery: 'Default',
  tankPercentages: [] as number[],
  payloadWeights: [] as number[],
  timeOfDay: 12,
  useRealWorldTime: false,
  coldAndDark: false,
  selectedWeather: 'clear',
  isLaunching: false,
  launchError: null,
};

export const useLaunchStore = create<LaunchState>()(
  persist(
    (set) => ({
      ...DEFAULT_CONFIG,
      favorites: [],

      selectAircraft: (aircraft) =>
        set({
          selectedAircraft: aircraft,
          selectedLivery: 'Default',
          tankPercentages: aircraft ? new Array((aircraft.tankNames ?? []).length).fill(50) : [],
          payloadWeights: aircraft
            ? new Array((aircraft.payloadStations ?? []).length).fill(0)
            : [],
          launchError: null,
        }),

      setSelectedLivery: (livery) => set({ selectedLivery: livery }),

      setTankPercentage: (index, value) =>
        set((state) => {
          const tankPercentages = [...state.tankPercentages];
          tankPercentages[index] = value;
          return { tankPercentages };
        }),

      setAllTanksPercentage: (value) =>
        set((state) => ({
          tankPercentages: state.tankPercentages.map(() => value),
        })),

      setPayloadWeight: (index, value) =>
        set((state) => {
          const payloadWeights = [...state.payloadWeights];
          payloadWeights[index] = value;
          return { payloadWeights };
        }),

      setTimeOfDay: (value) => set({ timeOfDay: value }),

      setUseRealWorldTime: (value) => set({ useRealWorldTime: value }),

      setColdAndDark: (value) => set({ coldAndDark: value }),

      setSelectedWeather: (value) => set({ selectedWeather: value }),

      toggleFavorite: (path) =>
        set((state) => ({
          favorites: state.favorites.includes(path)
            ? state.favorites.filter((p) => p !== path)
            : [...state.favorites, path],
        })),

      setIsLaunching: (value) => set({ isLaunching: value }),

      setLaunchError: (error) => set({ launchError: error }),

      resetConfig: () => set(DEFAULT_CONFIG),
    }),
    {
      name: 'launch-store',
      partialize: (state) => ({
        favorites: state.favorites,
        selectedAircraft: state.selectedAircraft,
        selectedLivery: state.selectedLivery,
        tankPercentages: state.tankPercentages,
        payloadWeights: state.payloadWeights,
        timeOfDay: state.timeOfDay,
        useRealWorldTime: state.useRealWorldTime,
        coldAndDark: state.coldAndDark,
        selectedWeather: state.selectedWeather,
      }),
      // Migrate old fuelPercentage to tankPercentages
      migrate: (persisted: unknown) => {
        const state = persisted as Record<string, unknown>;
        if ('fuelPercentage' in state && !('tankPercentages' in state)) {
          const pct = (state.fuelPercentage as number) ?? 50;
          const aircraft = state.selectedAircraft as Aircraft | null;
          const tankCount = aircraft?.tankNames.length || 0;
          state.tankPercentages = new Array(tankCount).fill(pct);
          state.payloadWeights = new Array(aircraft?.payloadStations?.length || 0).fill(0);
          delete state.fuelPercentage;
        }
        return state as unknown as LaunchState;
      },
      version: 1,
    }
  )
);
